Default to using Bun instead of Node.js.

Use bun <file> instead of node <file> or ts-node <file>
Use bun test instead of jest or vitest
Use bun build <file.html|file.ts|file.css> instead of webpack or esbuild
Use bun install instead of npm install or yarn install or pnpm install
Use bun run <script> instead of npm run <script>
Use bunx <package> <command> instead of npx <package> <command>
Bun automatically loads .env, so don't use dotenv.

APIs
Bun.serve() supports WebSockets, HTTPS, and routes. Don't use express.
bun:sqlite for SQLite. Don't use better-sqlite3.
Bun.redis for Redis. Don't use ioredis.
Bun.sql for Postgres. Don't use pg or postgres.js.
WebSocket is built-in. Don't use ws.
Prefer Bun.file over node:fs's readFile/writeFile

Testing
Use bun test to run tests.

Pull Requests
When creating PRs with gh pr create, use this exact format:

Title: <branch-type>: <issue-title-lowercased-hyphens>
Body:
  Closes #<issue-number>
  ## <issue title>
  ## What was implemented
  - <bullet list>
  ## Verification
  - [ ] <acceptance criteria>
  ## Notes (omit if empty)

---

# Santosh Standards

Coding, testing, and review patterns expected by Santosh. Follow these for all work.

## Scope Control

Optimize for less scope, not more.

- Narrowest implementation that satisfies the requirement — if only one read path is needed, do not build write paths
- Do not add endpoints, mutations, helpers, or configuration surface area not required by the current story or PR
- If a feature can be delivered with fewer moving parts, choose that version
- Prefer simpler implementation over extra abstraction
- Consistency with the existing codebase over invention

## Preserve Existing Behavior

Current defaults, seeds, flows, and semantics are intentional unless the task explicitly changes them.

- Do not remove or change a default that other code may rely on
- Do not change seed behavior, route behavior, config behavior, or data semantics without an explicit requirement
- Avoid incidental rewrites and "while I was here" behavior changes
- If a reviewer would ask "why was this changed?" and the PR did not need it — do not change it

## Prefer Existing Patterns

Do not invent a parallel local pattern if the codebase already has one.

- Check whether the codebase already has a shared type, utility, RPC/client pattern, standard component, preferred query shape, or canonical file before introducing anything new
- Follow established patterns closely — do not introduce a second style for the same kind of problem
- Prefer alignment over originality

## Avoid Unnecessary Abstraction

Do not create extra types, wrappers, adapters, DTOs, helpers, or layers unless they remove a real problem.

- Avoid types that restate existing schema-backed types
- Avoid wrappers around functions that are already simple enough
- Avoid custom helpers where a shared helper already exists
- Avoid abstractions created only to make code look cleaner in the moment
- If the same thing already exists, reuse it — if the code can be simpler without losing clarity, simplify it
- Do not mistake additional structure for better engineering

## Code Location

Keep logic in the layer where the rest of the codebase expects to find it.

- Schema-related logic stays with schema code, query logic goes where queries normally live
- UI components go where similar UI components already live
- Do not scatter related logic across new files when the codebase already has a canonical home for it

## Query and Data-Access Style

Prefer the simplest correct query shape.

- Do not over-model or indirect a query when a direct filter, join, or lookup would be clearer
- Keep filtering and joining in the appropriate layer
- Avoid cleverness that obscures what data is actually being fetched
- Prefer queries that make ownership and constraints obvious
- If a simpler query would be easier to read and equally correct, use it

## Testing

Do not mock the database. Tests should use real DB, real fixtures, and real seeds.

- Never mock the database — no `mock.module(...)`, no fake SQL clients, no `createMockSql()` helpers
- Use real test DB with `getDb()` from `db/client.ts`
- Load schema from `tools/fixtures/schema.sql` using `getDb().unsafe(await Bun.file("...").text())`
- Seed data using real `INSERT INTO` statements
- Run the actual tool/query against seeded DB, assert real output
- Use `.env.test` — never production credentials
- Run with `bun run test`

Expected test shape:
```ts
beforeAll(async () => {
  await getDb().unsafe(await Bun.file("tools/fixtures/schema.sql").text());
});
beforeEach(async () => {
  await getDb().unsafe("TRUNCATE TABLE ... RESTART IDENTITY CASCADE");
  await seedFixtures(getDb());
});
test("behavior description", async () => {
  const result = await tool.run({...});
  expect(result).toEqual(...);
});
```

## Fixtures and Seeds

- Schema SQL lives in `tools/fixtures/schema.sql` — not inline `CREATE TABLE` in test files
- Seed SQL lives in `tools/fixtures/seed.ts` — not inline `INSERT` in test files
- Create reusable seed helpers: `seedFixtures(db, overrides?)`
- Fixture schema should match production table shape (columns, indexes)
- Seed data should be behavior-focused — no giant `$1` to `$14` placeholder inserts
- Prefer shared fixture setup over long inline setup in every test file

## DB / Tool Code

- Use `getDb()` from `../db/client` — avoid direct `sql` singleton
- Normalize Postgres date columns — they may return as `Date` objects, not strings
- Keep SQL real and straightforward — don't copy query logic into TypeScript mocks
- Optimize for correctness first, then simplicity

## Comments, Dead Code, Scaffolding

Remove non-essential comments and artifacts before review.

- No inline comments in test code
- No section comments like `// Tool tests` or `// Pure helpers`
- No thinking comments like `// Wait, does this...`
- Let test names, helper names, and assertions explain intent
- Remove commented-out code, placeholder files, dead files, and obvious AI-generated scaffolding before review
- Only add comments that explain genuinely non-obvious production logic

## Configuration

Be explicit about required configuration.

- If an environment variable or config value is required, validate it early and fail fast
- Do not silently fallback in a way that hides broken configuration unless that fallback is an established and intentional part of the system

## PR Hygiene

- Keep branches merged with `main`
- Resolve conflicts using main's current structure (especially shared fixtures and db client)
- Before merge: mergeable, clean, CI green, no mocks, no comments, shared fixtures used

## Pre-PR Self-Review Checklist

Before considering the work ready, verify all of the following:

- Did I add anything not required right now?
- Did I change any existing behavior without explicit need?
- Did I introduce a new pattern where the codebase already had one?
- Did I duplicate any type, utility, helper, or component?
- Did I place the code in the canonical location?
- Did I choose the simplest correct query or data-access path?
- Did I use realistic tests where correctness depends on DB behavior?
- Did I consolidate fixtures and seeds instead of inlining setup?
- Did I remove unnecessary comments, dead code, and scaffolding?
- Is CI green, no mocks, no comments, shared fixtures used?

## Agent Decision Rules

When deciding between two implementations, prefer the one that:

1. Changes less
2. Matches existing code more closely
3. Introduces fewer new concepts
4. Preserves behavior more safely
5. Is easier to test with real data

If one option is more flexible but the other is more consistent and narrower, pick the narrower one.
