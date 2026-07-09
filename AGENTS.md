# Agent Instructions

Use these standards before making code changes, writing tests, opening PRs, or responding to reviewer feedback.

If Santosh leaves a new review comment, decide whether it is:

- A reusable standard: add it to `~/.config/dev-standards/SANTOSH_STANDARDS.md` and apply it to the branch.
- PR-specific feedback: apply it to the branch only.

Do not update global standards for one-off data values, branch-specific bugs, or comments that only apply to one PR.

## Bun Defaults

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`.
- Use `bun test` or the repo's existing Bun test script.
- Use `bun run <script>` instead of npm/yarn/pnpm equivalents.
- Use `bun install` instead of npm/yarn/pnpm equivalents.
- Use `bunx <package> <command>` instead of `npx`.
- Bun automatically loads `.env`; do not add `dotenv`.
- Prefer Bun APIs when the repo already uses them.

## Santosh Standards

### Scope Control

Optimize for less scope, not more.

- Implement the narrowest change that satisfies the requirement.
- Do not add endpoints, mutations, helpers, config, or future-proofing that the current PR does not require.
- Prefer simple code over extra abstraction.
- Match the existing codebase instead of inventing a parallel pattern.

### Preserve Existing Behavior

Existing defaults, seeds, flows, and semantics are intentional unless the task explicitly changes them.

- Do not remove or change defaults without a requirement.
- Do not change seed behavior, route behavior, config behavior, or data semantics incidentally.
- Avoid "while I was here" rewrites.
- If a reviewer would ask why something changed and the PR did not need it, do not change it.

### Prefer Existing Patterns

- Search the codebase before introducing a new type, helper, query shape, component, or file pattern.
- Reuse shared types, utilities, schema-backed shapes, query helpers, and fixture patterns.
- Consistency beats originality.

### Avoid Unnecessary Abstraction

- Do not create wrappers, adapters, DTOs, helper layers, or new types unless they solve a real problem.
- Avoid types that restate existing schema-backed types.
- Avoid helper functions where a direct call is clearer and already follows local style.
- If the code can be simpler without losing clarity, simplify it.

### Code Location

- Put code where similar code already lives.
- Schema-related logic stays with schema or fixture files.
- Query logic goes where queries normally live.
- Do not scatter related logic across new files when the repo has a canonical home.

### Query and Data Access

- Prefer the simplest correct query.
- Keep filtering and joining in the appropriate layer.
- Avoid clever query indirection.
- Make ownership and constraints obvious.
- Use `getDb()` from the repo DB client when that is the local pattern.

### Tests

Do not mock database behavior.

- No `mock.module(...)` for DB code.
- No fake SQL clients.
- No `createMockSql()`, `makeMockClient()`, or fake row builders.
- Use the real test DB setup.
- Use the real `getDb()` path.
- Load schema from a shared fixture file such as `tools/fixtures/schema.sql`.
- Put seed data in shared fixture/seed files such as `tools/fixtures/seed.ts`.
- Do not put inline `INSERT INTO` seed data in test files.
- Run the real tool/query against seeded DB data.
- Assert behavior from real output.
- Use `.env.test` or local test DB credentials, never production credentials.

Expected shape:

```ts
beforeAll(async () => {
	await getDb().unsafe(await Bun.file("tools/fixtures/schema.sql").text());
});

beforeEach(async () => {
	await getDb().unsafe("TRUNCATE TABLE ... RESTART IDENTITY CASCADE");
	await seedFixtures(getDb());
});

test("behavior description", async () => {
	const result = await tool.run({ input: { organizationId } });
	expect(result).toEqual(expected);
});
```

### Fixtures and Seeds

- Schema SQL belongs in a shared schema fixture, not inline `CREATE TABLE` blocks in tests.
- Seed SQL belongs in shared seed helpers, not inline `INSERT` blocks in tests.
- Create reusable seed helpers like `seedFixtures(db, overrides?)`.
- Fixture schema should match production table shape closely enough for the tested behavior.
- Seed data should be behavior-focused and readable.
- Prefer shared seed helpers over one-off setup in every test file.

### Comments and Dead Code

- No inline comments in test code.
- No section comments like `// Tool tests`, `// Pure helpers`, or decorative separators.
- No thinking comments like `// Wait, does this...`.
- Let test names, helper names, and assertions explain intent.
- Remove commented-out code, placeholder files, dead files, and AI scaffolding.
- Only add production comments for genuinely non-obvious logic.

### Configuration

- Validate required configuration early.
- Do not hide broken config behind silent fallbacks unless that fallback is already an established repo pattern.

### PR Hygiene

- Keep branches merged with `main`.
- Resolve conflicts using main's current structure.
- Before saying a branch is ready, verify mergeable, clean, CI green, no DB mocks, no inline seed SQL in tests, no unnecessary comments, and shared fixtures used.

### Final Self-Review

Before finishing, check:

- Did I add anything not required?
- Did I change existing behavior without explicit need?
- Did I introduce a new pattern where one already existed?
- Did I duplicate a type, helper, component, or query?
- Did I place code in the canonical location?
- Did I use realistic DB tests where DB behavior matters?
- Did I move schema and seed data into fixtures?
- Did I remove unnecessary comments and scaffolding?
- Did I run the relevant checks?
