#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "node:fs";

type ViolationType = "mock" | "inline-sql" | "direct-sql" | "comment";

type Violation = {
	file: string;
	line: number;
	type: ViolationType;
	message: string;
	source: string;
};

const args = new Set(process.argv.slice(2));
const shouldFix = args.has("--fix");
const stagedOnly = args.has("--staged");

function run(command: string[]): string {
	const result = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" });
	if (!result.success) return "";
	return result.stdout.toString().trim();
}

function listFiles(): string[] {
	const output = stagedOnly
		? run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"])
		: run(["git", "ls-files"]);

	return output
		.split("\n")
		.map((file) => file.trim())
		.filter(Boolean)
		.filter((file) => /\.(ts|tsx|js|jsx)$/.test(file))
		.filter((file) => file !== "scripts/scan-cto-violations.ts")
		.filter((file) => existsSync(file));
}

function isTestFile(file: string): boolean {
	return /\.test\.(ts|tsx|js|jsx)$/.test(file);
}

function isToolFile(file: string): boolean {
	return /^tools\/[^/]+\.ts$/.test(file) || /^src\/tools\/[^/]+\.ts$/.test(file);
}

function hasLineCommentOutsideString(line: string): boolean {
	let single = false;
	let double = false;
	let template = false;

	for (let i = 0; i < line.length - 1; i++) {
		const current = line[i];
		const next = line[i + 1];

		if (current === "\\") {
			i++;
			continue;
		}

		if (current === "'" && !double && !template) single = !single;
		if (current === '"' && !single && !template) double = !double;
		if (current === "`" && !single && !double) template = !template;

		if (current === "/" && next === "/" && !single && !double && !template) {
			return true;
		}
	}

	return false;
}

function stripLineComment(line: string): string {
	let single = false;
	let double = false;
	let template = false;

	for (let i = 0; i < line.length - 1; i++) {
		const current = line[i];
		const next = line[i + 1];

		if (current === "\\") {
			i++;
			continue;
		}

		if (current === "'" && !double && !template) single = !single;
		if (current === '"' && !single && !template) double = !double;
		if (current === "`" && !single && !double) template = !template;

		if (current === "/" && next === "/" && !single && !double && !template) {
			return line.slice(0, i).trimEnd();
		}
	}

	return line;
}

function shouldAllowComment(line: string): boolean {
	const trimmed = line.trim();
	return (
		trimmed.startsWith("///") ||
		trimmed.startsWith("// @") ||
		trimmed.startsWith("// #") ||
		trimmed.startsWith("http://") ||
		trimmed.startsWith("https://")
	);
}

function detect(file: string): Violation[] {
	const lines = readFileSync(file, "utf-8").split("\n");
	const violations: Violation[] = [];

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		const lineNumber = index + 1;
		const trimmed = line.trim();

		if (/mock\.module\(/.test(trimmed)) {
			violations.push({
				file,
				line: lineNumber,
				type: "mock",
				message: "Remove mock.module and use real DB fixtures.",
				source: trimmed,
			});
		}

		if (/(createMockSql|makeMockClient|mockSql|MockClient)/.test(trimmed)) {
			violations.push({
				file,
				line: lineNumber,
				type: "mock",
				message: "Remove mock DB helpers and use real DB fixtures.",
				source: trimmed,
			});
		}

		if (isTestFile(file) && /\bCREATE\s+TABLE\b/i.test(trimmed)) {
			violations.push({
				file,
				line: lineNumber,
				type: "inline-sql",
				message: "Move schema SQL to a shared fixture file.",
				source: trimmed,
			});
		}

		if (isTestFile(file) && /\bINSERT\s+INTO\b/i.test(trimmed)) {
			violations.push({
				file,
				line: lineNumber,
				type: "inline-sql",
				message: "Move seed INSERT data to a shared seed fixture.",
				source: trimmed,
			});
		}

		if (isTestFile(file) && /(new SQL\(|const sql\s*=)/.test(trimmed)) {
			violations.push({
				file,
				line: lineNumber,
				type: "direct-sql",
				message: "Use the repo DB client, usually getDb().",
				source: trimmed,
			});
		}

		if ((isTestFile(file) || isToolFile(file)) && hasLineCommentOutsideString(line) && !shouldAllowComment(line)) {
			violations.push({
				file,
				line: lineNumber,
				type: "comment",
				message: "Remove unnecessary test/tool comments.",
				source: trimmed,
			});
		}
	}

	return violations;
}

function fixComments(file: string): number {
	if (!isTestFile(file) && !isToolFile(file)) return 0;

	const lines = readFileSync(file, "utf-8").split("\n");
	let count = 0;

	const nextLines: string[] = [];

	for (const line of lines) {
		if (!hasLineCommentOutsideString(line) || shouldAllowComment(line)) {
			nextLines.push(line);
			continue;
		}

		const stripped = stripLineComment(line);
		count++;

		if (stripped.trim().length > 0) {
			nextLines.push(stripped);
		}
	}

	if (count > 0) {
		writeFileSync(file, `${nextLines.join("\n")}\n`, "utf-8");
	}

	return count;
}

function printViolations(violations: Violation[]): void {
	const grouped = new Map<string, Violation[]>();
	for (const violation of violations) {
		const list = grouped.get(violation.file) ?? [];
		list.push(violation);
		grouped.set(violation.file, list);
	}

	for (const [file, fileViolations] of grouped) {
		console.log(`\n${file}`);
		for (const violation of fileViolations) {
			console.log(`  ${violation.line}: ${violation.type} - ${violation.message}`);
			console.log(`     ${violation.source}`);
		}
	}
}

const files = listFiles();

if (shouldFix) {
	let fixed = 0;
	for (const file of files) {
		fixed += fixComments(file);
	}
	if (fixed > 0) {
		console.log(`Removed ${fixed} comment line(s). Review with git diff.`);
	}
}

const violations = files.flatMap(detect);

if (violations.length > 0) {
	console.log("\nCTO standards violations found:");
	printViolations(violations);
	console.log("\nFix these manually, or run with --fix to remove comment violations only.");
	process.exit(1);
}

console.log("CTO standards scan clean.");
