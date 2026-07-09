#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "fs";

const repoRoot = (() => {
  const r = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { stdout: "pipe", stderr: "pipe" });
  return r.success ? r.stdout.toString().trim() : process.cwd();
})();

interface Violation {
  file: string;
  line: number;
  source: string;
  type: "mock" | "inline-sql" | "direct-sql";
  message: string;
}

interface AutoFix {
  file: string;
  line: number;
  description: string;
}

function getChangedFiles(localSha: string, remoteSha: string): string[] {
  if (/^0+$/.test(remoteSha)) {
    const base = Bun.spawnSync(
      ["git", "merge-base", "origin/main", localSha],
      { stdout: "pipe", stderr: "pipe", cwd: repoRoot }
    );
    if (base.success) {
      remoteSha = base.stdout.toString().trim();
    }
  }

  const result = Bun.spawnSync(
    ["git", "diff", "--name-only", "--diff-filter=ACM", remoteSha, localSha],
    { stdout: "pipe", stderr: "pipe", cwd: repoRoot }
  );

  if (!result.success) return [];
  return result.stdout.toString().trim().split("\n").filter(Boolean);
}

function isTestFile(path: string): boolean {
  return /\.test\.(ts|tsx|js|jsx)$/.test(path);
}

function isToolFile(path: string): boolean {
  if (isTestFile(path)) return false;
  return /^tools\/[^/]+\.ts$/.test(path) || /^src\/tools\/[^/]+\.ts$/.test(path);
}

function readFile(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

function writeFile(path: string, content: string): void {
  writeFileSync(path, content, "utf-8");
}

function hasTrailingComment(line: string): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;

  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : "";
    const next = line[i + 1];

    if (ch === "\\") {
      i++;
      continue;
    }

    if (ch === "'" && !inDoubleQuote && !inTemplate) inSingleQuote = !inSingleQuote;
    else if (ch === '"' && !inSingleQuote && !inTemplate) inDoubleQuote = !inDoubleQuote;
    else if (ch === "`" && !inSingleQuote && !inDoubleQuote) inTemplate = !inTemplate;

    if (ch === "/" && next === "/" && !inSingleQuote && !inDoubleQuote && !inTemplate) {
      return true;
    }
  }
  return false;
}

function stripTrailingComment(line: string): string {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;

  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : "";
    const next = line[i + 1];

    if (ch === "\\") {
      i++;
      continue;
    }

    if (ch === "'" && !inDoubleQuote && !inTemplate) inSingleQuote = !inSingleQuote;
    else if (ch === '"' && !inSingleQuote && !inTemplate) inDoubleQuote = !inDoubleQuote;
    else if (ch === "`" && !inSingleQuote && !inDoubleQuote) inTemplate = !inTemplate;

    if (ch === "/" && next === "/" && !inSingleQuote && !inDoubleQuote && !inTemplate) {
      const trimmed = line.slice(0, i).trimEnd();
      return trimmed;
    }
  }
  return line;
}

function shouldSkipCommentLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith("/// ")) return true;
  if (trimmed.startsWith("import ")) return true;
  if (trimmed.startsWith("export ")) return true;
  if (/^\s*\/\*\*/.test(trimmed)) return true;
  if (trimmed.startsWith("// #")) return true;
  if (trimmed.startsWith("// @")) return true;
  return false;
}

function isSectionCommentOnly(line: string): boolean {
  const trimmed = line.trim();
  if (!/^\/\/\s/.test(trimmed)) return false;
  if (/\/\/\s*─{2,}/.test(trimmed)) return true;
  if (/\/\/\s*\d+\.?$/.test(trimmed) && trimmed.length < 20) return true;
  return false;
}

function processTestFile(filePath: string): AutoFix[] {
  const fullPath = `${repoRoot}/${filePath}`;
  const content = readFile(fullPath);
  if (!content) return [];

  const lines = content.split("\n");
  const autoFixes: AutoFix[] = [];
  let inBlockComment = false;
  const newLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (inBlockComment) {
      const endIdx = line.indexOf("*/");
      if (endIdx !== -1) {
        inBlockComment = false;
        const after = line.slice(endIdx + 2);
        if (after.trim()) newLines.push(after);
      }
      continue;
    }

    const blockMatch = line.match(/(\/\*.*?\*\/)/g);
    if (blockMatch && !shouldSkipCommentLine(line)) {
      let cleaned = line;
      for (const bm of blockMatch) {
        if (!/\/\*\*/.test(bm)) {
          cleaned = cleaned.replace(bm, "");
          if (line.includes(bm)) {
            autoFixes.push({ file: filePath, line: lineNum, description: "removed block comment" });
          }
        }
      }
      if (cleaned.trim()) {
        newLines.push(cleaned);
      }
      continue;
    }

    const blockStart = line.indexOf("/*");
    if (blockStart !== -1 && !shouldSkipCommentLine(line)) {
      const beforeBlock = line.slice(0, blockStart).trimEnd();
      const afterStart = line.slice(blockStart);

      if (/\/\s*\*/.test(afterStart) || /\/\s*\n/.test(afterStart)) {
        newLines.push(line);
        continue;
      }

      inBlockComment = true;
      if (beforeBlock) newLines.push(beforeBlock);
      autoFixes.push({ file: filePath, line: lineNum, description: "removed block comment" });
      continue;
    }

    if (shouldSkipCommentLine(line)) {
      newLines.push(line);
      continue;
    }

    if (/^\s*\/\/\s*$/.test(line)) {
      autoFixes.push({ file: filePath, line: lineNum, description: "removed empty comment line" });
      continue;
    }

    if (isSectionCommentOnly(line)) {
      autoFixes.push({ file: filePath, line: lineNum, description: "removed section comment" });
      continue;
    }

    if (hasTrailingComment(line)) {
      const cleaned = stripTrailingComment(line);
      if (!cleaned.trim()) {
        autoFixes.push({ file: filePath, line: lineNum, description: "removed comment-only line" });
        continue;
      }
      if (cleaned !== line) {
        autoFixes.push({ file: filePath, line: lineNum, description: "stripped trailing comment" });
        newLines.push(cleaned);
        continue;
      }
    }

    newLines.push(line);
  }

  if (autoFixes.length > 0) {
    writeFile(fullPath, newLines.join("\n") + "\n");
  }

  return autoFixes;
}

function processToolFile(filePath: string): AutoFix[] {
  const fullPath = `${repoRoot}/${filePath}`;
  const content = readFile(fullPath);
  if (!content) return [];

  const lines = content.split("\n");
  const autoFixes: AutoFix[] = [];
  const newLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (isSectionCommentOnly(line)) {
      autoFixes.push({ file: filePath, line: lineNum, description: "removed section comment" });
      continue;
    }

    newLines.push(line);
  }

  if (autoFixes.length > 0) {
    writeFile(fullPath, newLines.join("\n") + "\n");
  }

  return autoFixes;
}

function detectViolations(filePath: string): Violation[] {
  const fullPath = `${repoRoot}/${filePath}`;
  const content = readFile(fullPath);
  if (!content) return [];

  const violations: Violation[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    if (trimmed.includes("mock.module(")) {
      violations.push({
        file: filePath, line: lineNum, source: trimmed.slice(0, 80),
        type: "mock",
        message: "Remove mock.module(), use real DB fixtures",
      });
    }

    if (trimmed.includes("createMockSql") || trimmed.includes("makeMockClient")) {
      violations.push({
        file: filePath, line: lineNum, source: trimmed.slice(0, 80),
        type: "mock",
        message: "Remove mock helper, use real DB",
      });
    }

    if (/(CREATE\s+TABLE|CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS)/i.test(trimmed)) {
      violations.push({
        file: filePath, line: lineNum, source: trimmed.slice(0, 80),
        type: "inline-sql",
        message: "Move CREATE TABLE to tools/fixtures/schema.sql",
      });
    }

    if (/INSERT\s+INTO\s+public\./i.test(trimmed)) {
      violations.push({
        file: filePath, line: lineNum, source: trimmed.slice(0, 80),
        type: "inline-sql",
        message: "Move seed INSERT to tools/fixtures/seed.ts",
      });
    }

    if (trimmed.includes("const sql") || trimmed.includes("new SQL(")) {
      violations.push({
        file: filePath, line: lineNum, source: trimmed.slice(0, 80),
        type: "direct-sql",
        message: "Use getDb() from db/client.ts instead of direct SQL client",
      });
    }
  }

  return violations;
}

function main() {
  const args = process.argv.slice(2);
  const localSha = args[0];
  const remoteSha = args[1] || "";

  if (!localSha) {
    process.exit(0);
  }

  const changedFiles = getChangedFiles(localSha, remoteSha);
  const testFiles = changedFiles.filter(isTestFile);
  const toolFiles = changedFiles.filter(isToolFile);

  const allAutoFixes: AutoFix[] = [];

  for (const file of testFiles) {
    allAutoFixes.push(...processTestFile(file));
  }

  for (const file of toolFiles) {
    allAutoFixes.push(...processToolFile(file));
  }

  if (allAutoFixes.length > 0) {
    console.log("\n--- Pass 1: Auto-fix (comments) ---");
    const byFile = new Map<string, AutoFix[]>();
    for (const fix of allAutoFixes) {
      if (!byFile.has(fix.file)) byFile.set(fix.file, []);
      byFile.get(fix.file)!.push(fix);
    }

    for (const [file, fixes] of byFile) {
      console.log(`\n  ${file}`);
      for (const fix of fixes) {
        console.log(`    Line ${fix.line}: ${fix.description}`);
      }
    }
    console.log(`\n  > ${allAutoFixes.length} fix(es) applied — review with \`git diff\`\n`);
  }

  const allViolations: Violation[] = [];

  for (const file of testFiles) {
    allViolations.push(...detectViolations(file));
  }

  for (const file of toolFiles) {
    allViolations.push(...detectViolations(file));
  }

  if (allViolations.length > 0) {
    console.log("--- Pass 2: Violation scan ---");

    const byFile = new Map<string, Violation[]>();
    for (const v of allViolations) {
      if (!byFile.has(v.file)) byFile.set(v.file, []);
      byFile.get(v.file)!.push(v);
    }

    for (const [file, violations] of byFile) {
      console.log(`\n  ${file}`);
      for (const v of violations) {
        console.log(`    Line ${v.line}: ${v.type} — ${v.message}`);
        console.log(`      ${v.source}`);
      }
    }

    const mockFiles = [...new Set(allViolations.filter(v => v.type === "mock").map(v => v.file))];
    const sqlFiles = [...new Set(allViolations.filter(v => v.type === "inline-sql").map(v => v.file))];
    const directSqlFiles = [...new Set(allViolations.filter(v => v.type === "direct-sql").map(v => v.file))];

    const promptParts: string[] = ["Fix Santosh violations:"];

    if (mockFiles.length > 0) {
      promptParts.push(`- Replace mock.module in ${mockFiles.join(", ")} with real DB fixtures`);
    }
    if (sqlFiles.length > 0) {
      promptParts.push(`- Move inline SQL from ${sqlFiles.join(", ")} to tools/fixtures/seed.ts or schema.sql`);
    }
    if (directSqlFiles.length > 0) {
      promptParts.push(`- Replace direct SQL client in ${directSqlFiles.join(", ")} with getDb() from db/client.ts`);
    }
    promptParts.push("Follow ~/.config/opencode/SANTOSH_STANDARDS.md");

    const promptStr = promptParts.join("\n");

    console.log("\n" + "=".repeat(55));
    console.log("  To fix, give this prompt to your agent:");
    console.log("=".repeat(55));
    console.log(`\n  ${promptStr.replace(/\n/g, "\n  ")}\n`);

    process.exit(1);
  }

  if (allAutoFixes.length > 0) {
    console.log("Pass 2: clean — no violations remaining\n");
  } else {
    console.log("Pass 1 & 2: clean — no violations found\n");
  }
}

main();
