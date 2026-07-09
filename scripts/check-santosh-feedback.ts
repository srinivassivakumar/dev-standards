#!/usr/bin/env bun

const STANDARDS_FILE = `${process.env.HOME}/.config/opencode/SANTOSH_STANDARDS.md`;
const PENDING_FILE = `${process.env.HOME}/.config/opencode/.santosh_feedback_pending`;
const REVIEWER = "santoshdeshpande";

function run(cmd: string[], opts?: { cwd?: string }): string | null {
  const result = Bun.spawnSync(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    ...opts,
  });
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

interface SantoshReview {
  prNumber: number;
  prTitle: string;
  prUrl: string;
  reviewState: string;
  reviewBody: string;
  reviewUrl: string;
  submittedAt: string;
  hasNewCommitsSince: boolean;
}

async function checkPrReviews(
  repo: string,
  author: string
): Promise<SantoshReview[]> {
  const activeReviews: SantoshReview[] = [];

  const prJson = run([
    "gh",
    "api",
    `repos/${repo}/pulls`,
    "--jq",
    `.[] | select(.user.login == "${author}" and .state == "open") | {number: .number, title: .title, url: .html_url}`,
  ]);

  if (!prJson) return [];

  const prs = prJson
    .split(/\n(?=\{)/)
    .map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    })
    .filter((p): p is { number: number; title: string; url: string } => !!p?.number);

  for (const pr of prs) {
    const reviews = run([
      "gh",
      "api",
      `repos/${repo}/pulls/${pr.number}/reviews`,
      "--jq",
      `.[] | select(.user.login == "${REVIEWER}") | {state: .state, body: .body, url: .html_url, submitted_at: .submitted_at}`,
    ]);

    if (!reviews) continue;

    const reviewList = reviews
      .split(/\n(?=\{)/)
      .map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter((r): r is { state: string; body?: string; url: string; submitted_at: string } => !!r);

    const latestChangesRequested = reviewList.findLast(
      (r) => r.state === "CHANGES_REQUESTED"
    );
    const latestApproved = reviewList.findLast(
      (r) => r.state === "APPROVED"
    );

    if (!latestChangesRequested) continue;

    if (
      latestApproved &&
      new Date(latestApproved.submitted_at) >
        new Date(latestChangesRequested.submitted_at)
    ) {
      continue;
    }

    const prCommits = run([
      "gh",
      "api",
      `repos/${repo}/pulls/${pr.number}/commits`,
      "--jq",
      `.[].commit.committer.date`,
    ]);

    const hasNewCommitsSince = prCommits
      ? prCommits
          .split("\n")
          .some(
            (d) =>
              new Date(d) > new Date(latestChangesRequested.submitted_at)
          )
      : false;

    activeReviews.push({
      prNumber: pr.number,
      prTitle: pr.title,
      prUrl: pr.url,
      reviewState: latestChangesRequested.state,
      reviewBody: latestChangesRequested.body || "",
      reviewUrl: latestChangesRequested.url,
      submittedAt: latestChangesRequested.submitted_at,
      hasNewCommitsSince,
    });
  }

  return activeReviews;
}

async function loadStandards(): Promise<string> {
  const file = Bun.file(STANDARDS_FILE);
  if (!(await file.exists())) return "";
  return file.text();
}

function findNewRules(
  reviews: SantoshReview[],
  standardsContent: string
): SantoshReview[] {
  const keywords = [
    { word: "mock", rule: "mock" },
    { word: "comment", rule: "comment" },
    { word: "seed", rule: "seed" },
    { word: "fixture", rule: "fixture" },
    { word: "schema", rule: "schema" },
    { word: "insert", rule: "seed/fixture" },
    { word: "sql", rule: "SQL" },
    { word: "test", rule: "test" },
    { word: "lint", rule: "lint" },
    { word: "format", rule: "format" },
    { word: "typecheck", rule: "typecheck" },
    { word: "unittest", rule: "test" },
  ];

  const standardsLower = standardsContent.toLowerCase();

  return reviews.filter((r) => {
    const body = r.reviewBody.toLowerCase();
    const mentionedRules = keywords
      .filter((k) => body.includes(k.word))
      .map((k) => k.rule);
    const uniqueRules = [...new Set(mentionedRules)];
    const allCovered = uniqueRules.every((rule) =>
      standardsLower.includes(rule)
    );
    return !allCovered;
  });
}

async function main() {
  const repo = getCurrentRepo();
  const author = getGhUser();

  if (!repo || !author) return;

  const reviews = await checkPrReviews(repo, author);

  const activeReviews = reviews.filter((r) => !r.hasNewCommitsSince);

  if (activeReviews.length === 0) return;

  const standardsContent = await loadStandards();
  const newReviews = findNewRules(activeReviews, standardsContent);

  if (newReviews.length === 0) return;

  Bun.write(
    PENDING_FILE,
    JSON.stringify(
      newReviews.map((r) => ({
        pr: r.prNumber,
        title: r.prTitle,
        url: r.reviewUrl,
        excerpt: r.reviewBody.slice(0, 500),
        submittedAt: r.submittedAt,
      })),
      null,
      2
    )
  );

  console.log(
    `\n${newReviews.length} PR(s) with new Santosh feedback not yet covered in SANTOSH_STANDARDS.md:\n`
  );
  for (const r of newReviews) {
    console.log(`  PR #${r.prNumber} — ${r.prTitle}`);
    console.log(`  ${r.reviewUrl}`);
    console.log(`  ${r.reviewBody.slice(0, 200)}...\n`);
  }
  console.log(
    "Run 'sync-santosh-rules' to update standards, then push again."
  );
  process.exit(1);
}

main().catch(() => {});
