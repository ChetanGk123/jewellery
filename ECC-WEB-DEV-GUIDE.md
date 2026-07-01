# ECC Web Development Guide (TypeScript)

A practical guide to using the ECC tooling installed in this project for everyday
TypeScript / web app development.

> **What's installed here**
>
> | Surface | Location | Count |
> |---------|----------|-------|
> | Rules | `.claude/rules/ecc/` | 42 files (common, typescript, web, react, vue, nuxt, angular) |
> | Skills | `.claude/skills/` | 28 |
> | Agents | `.claude/agents/` | 23 |
> | Commands | `.claude/commands/` | 65 (`/command-name`) |
> | MCP servers | `.mcp.json` | 7 (chrome-devtools, playwright, context7, magic, vercel, **fallow**, **shadcn**) |
> | Hooks | via `ecc` plugin (auto-active) | 28 |
> | Rule wiring | `CLAUDE.md` | imports all rule sets each session |

---

## 1. Mental model — how the pieces fit

- **Rules** are *always-on* guidance. They're imported by `CLAUDE.md`, so every
  session already follows ECC's TypeScript/web coding standards. You don't invoke
  them; they shape every response.
- **Skills** are *reference knowledge + workflows* the agent pulls in when a task
  matches (e.g. writing a React component activates `react-patterns`). You can also
  name one explicitly.
- **Agents** are *specialists you delegate to* — a reviewer, a build-fixer, an
  architect. They run focused work and report back.
- **Commands** (`/name`) are *entry points* that kick off a skill or agent workflow.
- **Hooks** are *automatic guardrails* that fire on tool events (format on save,
  typecheck after edit, block bad commits). They run without you asking.
- **MCP servers** are *external capabilities* (browser control, live docs, deploys).

A simple rule of thumb:
> **Commands** to start work · **Skills** for know-how · **Agents** for review &
> specialist passes · **Hooks** catch mistakes automatically.

---

## 2. The everyday loop

### Start a feature
```
/plan "Add user profile page with avatar upload"
```
`/plan` restates requirements, flags risks, and produces a step-by-step plan.
**It waits for your confirmation before writing code.** For a heavier kickoff that
includes research + TDD + review + a gated commit:
```
/orch-add-feature "user profile page with avatar upload"
```

### Write the code (TDD)
```
/react-test          # write React Testing Library tests first, then implement
```
or for general TDD across the stack:
```
/feature-dev "profile avatar upload"
```
While you build, the relevant skills auto-activate (`react-patterns`,
`frontend-patterns`, `frontend-a11y`, `motion-*`, `vite-patterns`, etc.).

### Fix build/type errors
```
/react-build         # React/Vite/Next/webpack build + JSX/TSX + hydration fixes
/build-fix           # generic: detect build system, fix type/build errors minimally
```

### Review before committing
```
/code-review         # reviews your uncommitted diff for bugs + cleanups
/react-review        # React-specific (hooks, render perf, RSC boundaries, a11y)
/vue-review          # Vue-specific
/security-scan       # AgentShield: secrets, injection, unsafe config
```

### Commit & PR
```
/prp-commit "commit the profile page components and tests"
/pr                  # pushes branch + opens a GitHub PR from your commits
```

---

## 3. Task → tool cheat sheet

| You want to… | Use |
|--------------|-----|
| Plan a feature | `/plan`, `/plan-prd`, `/prp-plan` |
| Build a feature end-to-end | `/orch-add-feature`, `/feature-dev` |
| Bootstrap an MVP from a spec | `/orch-build-mvp` |
| Change existing behavior safely | `/orch-change-feature` |
| Fix a bug (repro → regression test → fix) | `/orch-fix-defect` |
| Refactor without behavior change | `/orch-refine-code`, `/refactor-clean` (fed by Fallow evidence) |
| Get deterministic code-health evidence | **Fallow** MCP / `npx fallow audit` |
| Find dead code / duplication / hotspots | **Fallow**: `fallow dead-code`, `fallow dupes --mode semantic`, `fallow health --hotspots` |
| Write tests first | `/react-test`, `tdd-workflow` skill |
| Improve test coverage | `/test-coverage` |
| Fix a broken build | `/react-build`, `/build-fix` |
| Review code | `/code-review`, `/react-review`, `/vue-review` |
| Security pass | `/security-scan`, `security-reviewer` agent |
| Performance pass | `performance-optimizer` agent, `react-performance` skill |
| Accessibility | `accessibility` / `frontend-a11y` skills, `a11y-architect` agent |
| API/back-end work | `backend-patterns`, `api-design`, `nestjs-patterns`, `prisma-patterns` |
| Animations / motion | `motion-foundations` → `motion-patterns` → `motion-advanced` |
| Live library docs | `context7` MCP / `docs-lookup` agent |
| Browser/E2E testing | `e2e-testing` skill, `e2e-runner` agent, `playwright` MCP |
| Visual QA after deploy | `browser-qa` skill, `chrome-devtools` MCP |
| Record a demo video | `ui-demo` skill |
| Deploy | `deployment-patterns` skill, `vercel` MCP |
| Update docs/codemaps | `/update-docs`, `/update-codemaps` |

---

## 4. Skills by area (what auto-activates)

**React / Next.js**
`react-patterns` · `react-performance` · `react-testing` · `nextjs-turbopack`
`frontend-patterns` · `frontend-a11y` · `frontend-design-direction`

**Vue / Nuxt / Angular**
`vue-patterns` · `ui-to-vue` · `nuxt4-patterns` · `angular-developer`

**Build & runtime**
`vite-patterns` · `bun-runtime` · `deployment-patterns`

**Backend (TS)**
`backend-patterns` · `nestjs-patterns` · `prisma-patterns` · `api-design`

**UI / design / motion**
`design-system` · `ui-demo` · `motion-foundations` · `motion-patterns`
`motion-ui` · `motion-advanced`

**Quality**
`tdd-workflow` · `e2e-testing` · `browser-qa` · `accessibility`

You rarely call these directly — describe your task and the matching skill loads.
To force one, just mention it: *"use the prisma-patterns skill to design this schema."*

---

## 5. Agents you delegate to

| Agent | Use it for |
|-------|-----------|
| `typescript-reviewer` | Any TS/JS change — type safety, async correctness, security |
| `react-reviewer` / `vue-reviewer` | Framework-specific review of `.tsx`/`.vue` changes |
| `react-build-resolver` / `build-error-resolver` | Get a red build green with minimal diffs |
| `architect` / `code-architect` | System design, feature blueprints |
| `code-explorer` | Understand an existing codebase area before changing it |
| `security-reviewer` | Auth, input handling, API endpoints, secrets |
| `performance-optimizer` | Bottlenecks, bundle size, re-renders |
| `a11y-architect` | WCAG 2.2 component/design-system audits |
| `database-reviewer` | SQL, schema, migrations (Postgres/Supabase) |
| `e2e-runner` | Generate/maintain/run E2E journeys |
| `refactor-cleaner` | Remove dead code (knip, ts-prune, depcheck) |
| `silent-failure-hunter` | Swallowed errors, bad fallbacks |
| `test-*` / `pr-test-analyzer` | Test coverage quality |
| `doc-updater` | Codemaps + docs |

Delegate by asking, e.g. *"have the security-reviewer agent check the upload endpoint."*

---

## 6. Automatic guardrails (hooks)

These fire on their own while you work — no action needed:

- **On edit** (`.ts`/`.tsx`): Prettier format → `tsc --noEmit` typecheck →
  `console.log` warning → design-quality check → quality gate.
- **Before `git commit`**: lints staged files, validates commit message, blocks on
  secrets / `console.log` / `debugger`.
- **Before `git push`**: reminder to review changes.
- **Dev server**: blocks `npm run dev` outside tmux so logs stay accessible.
- **Session**: memory persistence (start/end) + strategic `/compact` suggestions +
  cost tracking.

Manage them:
```
/hookify-list        # see active hooks
/hookify-configure   # enable/disable individual rules
/hookify             # create your own project-specific guardrail
```

---

## 7. MCP servers (external capabilities)

| Server | What it gives you | Key needed? |
|--------|-------------------|-------------|
| `chrome-devtools` | Inspect/debug a running web app | No |
| `playwright` | Drive a real browser for E2E / screenshots | No |
| `context7` | Up-to-date library/framework docs on demand | No |
| `magic` | Generate Magic UI components | No |
| `vercel` | Deployments & project info | No (uses Vercel auth) |
| `fallow` | Deterministic codebase intelligence (dead code, dupes, complexity, architecture, security candidates, git-aware audit) | No |
| `shadcn` | Search & install shadcn/ui components and blocks from the registry | No |

To add key-based servers (GitHub, Supabase, etc.), edit `.mcp.json` and fill the
token — see the commented examples discussed during setup. Keep total active
MCPs **under ~10** to protect the context window.

---

## 8. Fallow — deterministic evidence layer

[Fallow](https://github.com/fallow-rs/fallow) is a Rust-native, **deterministic**
codebase intelligence engine for TS/JS. It is now wired in as the `fallow` MCP
server and complements ECC:

> **Fallow gives evidence. ECC agents make judgments and apply fixes.**
>
> - Fallow has **no AI inside** — same input → same output, reproducible & auditable.
> - It outputs structured JSON with a machine-actionable `next_steps`/`actions` array.
> - ECC agents (`refactor-cleaner`, `code-reviewer`, `typescript-reviewer`,
>   `silent-failure-hunter`) consume that evidence and act safely on it.

**CLI quick reference** (also available as MCP tools — agents can call it directly):
```bash
npx fallow audit              # git-aware: new vs pre-existing findings on changed files
fallow dead-code              # unused files / exports / deps / types
fallow dupes --mode semantic  # clone detection
fallow health --score --hotspots   # complexity + refactor targets
fallow security               # security candidates
npx fallow audit --format json     # machine-readable for CI / agents
```
> ⚠️ When running Fallow in Bash, append `|| true` — exit code **1 means "issues
> found"** (normal), not an error. Only exit code **2** is a real failure.

**How agents use it:** before deleting an export or a clone, the agent dispatches the
matching Fallow MCP tool (`trace_export`, `trace_clone`, `check_health`) to *verify*
the finding, then makes the change. This is the safe-cleanup loop:
`fallow finding → trace/verify → refactor-cleaner applies fix → re-run fallow`.

---

## 9. Recommended end-to-end workflow

```text
1. /plan "feature description"                 → confirm the plan
2. /orch-add-feature  (or /feature-dev)        → research + TDD build
3. (hooks auto-format + typecheck every edit)
4. /test-coverage                              → fill coverage gaps
5. npx fallow audit                            → deterministic risk/health evidence
6. /code-review  +  /react-review              → fix findings (uses Fallow evidence)
7. /refactor-clean                             → safe dead-code removal (Fallow-verified)
8. /security-scan  +  fallow security          → no secrets / vulns
9. /build-fix  (if anything is red)            → green build
10. /prp-commit "..."                          → commit
11. /pr                                         → open PR
12. /update-docs                                → keep docs in sync
```

For higher-stakes changes, swap step 6 for `/santa-loop` (two independent reviewers
must both approve before code ships).

---

## 10. Continuous improvement

- `/learn` — extract reusable patterns from this session into candidate skills.
- `/instinct-status` — see what the harness has learned for this project.
- `/cost-report` — local Claude Code cost report.
- `/harness-audit` — score this project's ECC setup and get prioritized fixes.
- `/ecc-guide` — browse the full live ECC surface (all agents/skills/commands).

---

## 11. Notes

- Everything here also exists globally via the `ecc` plugin (as `ecc:*`). The local
  copies in `.claude/` make this project **portable** — commit `.claude/` and anyone
  cloning gets the identical setup.
- This directory has no app yet. Scaffold one (React/Vite, Next.js, Nuxt, Angular)
  to put the tooling to work against real code.
