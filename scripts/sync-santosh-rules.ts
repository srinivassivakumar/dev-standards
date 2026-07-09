#!/usr/bin/env bun

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const STANDARDS_FILE = `${process.env.HOME}/.config/opencode/SANTOSH_STANDARDS.md`;
const PENDING_FILE = `${process.env.HOME}/.config/opencode/.santosh_feedback_pending`;

function main() {
  const pendingData = existsSync(PENDING_FILE)
    ? JSON.parse(readFileSync(PENDING_FILE, "utf-8"))
    : [];

  const standardsContent = existsSync(STANDARDS_FILE)
    ? readFileSync(STANDARDS_FILE, "utf-8")
    : "";

  let newContent = standardsContent.trimEnd();
  const prsSeen = new Set<number>();

  for (const item of pendingData) {
    if (!item.pr || prsSeen.has(item.pr)) continue;
    prsSeen.add(item.pr);

    const date = item.submittedAt
      ? new Date(item.submittedAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    newContent += `\n\n### PR #${item.pr} (${date})`;
    if (item.title) newContent += ` — ${item.title}`;
    newContent += `\n- ${(item.excerpt || "").slice(0, 300).replace(/\n/g, " ")}`;
    if (item.url) newContent += `\n  ${item.url}`;
  }

  const additions = newContent.slice(standardsContent.length).trim();

  if (additions) {
    console.log("Proposed additions:\n");
    console.log(additions);
    console.log("");

    writeFileSync(STANDARDS_FILE, newContent, "utf-8");
    writeFileSync(PENDING_FILE, "[]", "utf-8");

    console.log("Updated SANTOSH_STANDARDS.md.");
  } else {
    console.log("No pending Santosh feedback to sync.");
  }
}

main();
