#!/usr/bin/env bun

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const STANDARDS_FILE = `${process.env.HOME}/.config/opencode/SANTOSH_STANDARDS.md`;
const PROCESSED_FILE = `${process.env.HOME}/.config/opencode/.santosh_processed.json`;
const REVIEWER = "santoshdeshpande";

function run(cmd: string[], opts?: { cwd?: string }): string | null {
  const result = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe", ...opts });
  if (!result.success) return null;
  return result.stdout.toString().trim();
}

function getCurrentRepo(): string | null {
  const url = run(["git", "remote", "get-url", "origin"]);
  if (!url) return null;
  const match = url.match(/github\.com[/:](.+?)(?:\.git)?$/);
  return match ? match[1].replace(/\.git$/, "") : null;
}

function getGhUser(): string | null {
  return run(["gh", "api", "user", "--jq", ".login"]);
}

interface Comment {
  id: number;
  body: string;
  url: string;
  prNumber: number;
  prTitle: string;
  submittedAt: string;
}

function loadProcessed(): Set<number> {
  try {
    if (existsSync(PROCESSED_FILE)) {
      const data = JSON.parse(readFileSync(PROCESSED_FILE, "utf-8"));
      return new Set(data.ids || []);
    }
  } catch {}
  return new Set<number>();
}

function saveProcessed(ids: Set<number>): void {
  writeFileSync(PROCESSED_FILE, JSON.stringify({ ids: [...ids], updatedAt: new Date().toISOString() }, null, 2));
}

function loadStandards(): string {
  try {
    return readFileSync(STANDARDS_FILE, "utf-8");
  } catch {
    return "";
  }
}

function appendToStandards(rules: string[]): void {
  const current = loadStandards();
  writeFileSync(STANDARDS_FILE, current.trimEnd() + "\n" + rules.join("\n") + "\n", "utf-8");
}

function fetchAllComments(repo: string, author: string): Comment[] {
  const allComments: Comment[] = [];
  const processed = loadProcessed();

  const prJson = run([
    "gh", "api",
    `repos/${repo}/pulls`,
    "--jq",
    `.[] | select(.user.login == "${author}" and .state == "open") | {number: .number, title: .title}`,
  ]);

  if (!prJson) return [];

  const prs = prJson
    .split(/\n(?=\{)/)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((p): p is { number: number; title: string } => !!p?.number);

  for (const pr of prs) {
    const reviewsJson = run([
      "gh", "api",
      `repos/${repo}/pulls/${pr.number}/reviews`,
      "--jq",
      `.[] | select(.user.login == "${REVIEWER}") | {id: .id, body: .body, html_url: .html_url, submitted_at: .submitted_at}`,
    ]);

    if (reviewsJson) {
      const reviews = reviewsJson
        .split(/\n(?=\{)/)
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter((r): r is { id: number; body?: string; html_url: string; submitted_at: string } => !!r?.id);

      for (const review of reviews) {
        if (processed.has(review.id)) continue;
        if (!review.body || review.body.trim().length < 30) continue;

        allComments.push({
          id: review.id,
          body: review.body.trim(),
          url: review.html_url,
          prNumber: pr.number,
          prTitle: pr.title,
          submittedAt: review.submitted_at,
        });
      }
    }

    const inlineJson = run([
      "gh", "api",
      `repos/${repo}/pulls/${pr.number}/comments`,
      "--jq",
      `.[] | select(.user.login == "${REVIEWER}") | {id: .id, body: .body, html_url: .html_url, submitted_at: .created_at}`,
    ]);

    if (inlineJson) {
      const inlineComments = inlineJson
        .split(/\n(?=\{)/)
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter((c): c is { id: number; body?: string; html_url: string; submitted_at: string } => !!c?.id);

      for (const comment of inlineComments) {
        if (processed.has(comment.id)) continue;
        if (!comment.body || comment.body.trim().length < 30) continue;

        allComments.push({
          id: comment.id,
          body: comment.body.trim(),
          url: comment.html_url,
          prNumber: pr.number,
          prTitle: pr.title,
          submittedAt: comment.submitted_at,
        });
      }
    }
  }

  return allComments;
}

const VAGUE_PHRASES = [
  "address changes", "fix this", "remove them", "do this",
  "address this", "change this", "fix it", "please address",
  "please do", "please fix",
];

function isMeaningfulRule(rule: string): boolean {
  const stripped = rule
    .replace(/^-\s*(?:Always|Never|Must|Should|Use|Create|Remove|Move|Do not)\s*/i, "")
    .replace(/[.,;]$/, "")
    .trim()
    .toLowerCase();

  if (stripped.length < 15) return false;
  if (VAGUE_PHRASES.some((p) => stripped.includes(p) && stripped.length < 30)) return false;

  const meaningfulWords = stripped.split(/\s+/).filter((w) => w.length > 2).length;
  if (meaningfulWords < 3) return false;

  return true;
}

function extractRules(body: string): string[] {
  const rules: string[] = [];

  const extract = (pattern: RegExp, prefix: string): void => {
    let match;
    const regex = new RegExp(pattern.source, "gi");
    while ((match = regex.exec(body)) !== null) {
      let phrase = (match[1] || match[0] || "").trim();
      if (match[2]) phrase = `${match[1].trim()} instead of ${match[2].trim()}`;

      phrase = phrase
        .replace(/[`"']/g, "")
        .replace(/@\w+/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .replace(/[.,;]$/, "")
        .trim();

      if (phrase.length < 10) continue;

      phrase = phrase.charAt(0).toUpperCase() + phrase.slice(1);

      const rule = `${prefix} ${phrase}.`;
      if (isMeaningfulRule(rule)) {
        rules.push(rule);
      }
    }
  };

  const longSentences = body.match(/[^.]+(?:don't|never|should|must|always|use|create|move|remove|seed)[^.]+\./gi) || [];
  const combined = longSentences.join(" ") + " " + body;

  extract(/never\s+(.+?)(?:[.,;]|$)/gi, "- Never");
  extract(/do\s+not\s+(.+?)(?:[.,;]|$)/gi, "- Do not");
  extract(/don'?t\s+(.+?)(?:[.,;]|$)/gi, "- Do not");

  extract(/use\s+(.+?)\s+instead\s+of\s+(.+?)(?:[.,;]|$)/gi, "- Use");
  extract(/move\s+(.+?)\s+(?:to|into)\s+(.+?)(?:[.,;]|$)/gi, "- Move");
  extract(/create\s+(?:a\s+)?(?:standard|shared|common)\s+(.+?)(?:[.,;]|$)/gi, "- Create shared");

  extract(/seeds?\s+should\s+(.+?)(?:[.,;]|$)/gi, "- Seed data should");
  extract(/(?:tests?\s+)?should\s+use\s+(.+?)(?:[.,;]|$)/gi, "- Use");

  extract(/please\s+use\s+(.+?)(?:[.,;]|$)/gi, "- Use");
  extract(/please\s+remove\s+(.+?)(?:[.,;]|$)/gi, "- Remove");
  extract(/please\s+create\s+(.+?)(?:[.,;]|$)/gi, "- Create");
  extract(/please\s+move\s+(.+?)(?:[.,;]|$)/gi, "- Move");

  return [...new Set(rules)].slice(0, 8);
}

function isRuleCovered(newRule: string, standards: string): boolean {
  const keywords = newRule
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (keywords.length === 0) return true;

  const standardsLower = standards.toLowerCase();
  const matched = keywords.filter((kw) => standardsLower.includes(kw));
  return matched.length / keywords.length >= 0.6;
}

function main() {
  const repo = getCurrentRepo();
  const author = getGhUser();

  if (!repo || !author) return;

  const comments = fetchAllComments(repo, author);
  const processed = loadProcessed();
  const standards = loadStandards();

  const newRulesMap = new Map<string, Comment>();
  let newRuleCount = 0;

  for (const comment of comments) {
    const extracted = extractRules(comment.body);
    for (const rule of extracted) {
      if (!isRuleCovered(rule, standards)) {
        newRulesMap.set(rule, comment);
      }
    }
    processed.add(comment.id);
  }

  if (newRulesMap.size === 0) {
    if (comments.length > 0) {
      saveProcessed(processed);
    }
    return;
  }

  const newRules: string[] = [];
  const prSeen = new Set<number>();

  for (const [rule, comment] of newRulesMap) {
    if (!prSeen.has(comment.prNumber)) {
      const date = new Date(comment.submittedAt).toISOString().slice(0, 10);
      newRules.push(`\n### PR #${comment.prNumber} (${date})`);
      prSeen.add(comment.prNumber);
    }
    newRules.push(rule);
    if (comment.url) {
      newRules.push(`  ${comment.url}`);
    }
    newRuleCount++;
  }

  appendToStandards(newRules);
  saveProcessed(processed);

  console.log(`Santosh Rules: ${newRuleCount} new rule(s) added to SANTOSH_STANDARDS.md`);
  for (const line of newRules) {
    if (line.trim()) console.log(`  ${line}`);
  }
  console.log("");
}

main();
