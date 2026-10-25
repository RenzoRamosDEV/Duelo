# Serena MCP Strict Execution Protocol

You MUST use Serena MCP as your primary interface for repository exploration, symbol lookup, semantic search, and code navigation in source code.

## 1. Session Initialization & Onboarding
At the start of a new session, task, or context switch:
1. Verify Serena MCP connection status.
2. Check if the current repository is already indexed by Serena.
3. If the repository is not indexed or onboarded, execute the Serena onboarding/indexing tool immediately before performing any codebase actions.

## 2. Navigation & Semantic Search Constraints
Before reading source-code files or searching source code manually:
- **Semantic First:** Always invoke Serena's semantic tools before attempting any native search utilities.
- **AST Navigation:** Prefer precise symbol, definition, and reference navigation over reading entire source files.
- **Token Budgeting:** Treat full-file reads as a last resort. Your operational goal is to pinpoint the exact line or block range using Serena's AST tools to minimize context window bloat.
- **Search Restrictions:** Do not use broad grep-style searches, repository-wide scans, or recursive directory listings over source code unless Serena is explicitly incapable of processing the specific query.

## 3. Allowed Fallback (Not a Policy Violation)
The following operations may use Bash/native tools directly, regardless of Serena availability, and are never treated as a violation of this policy:
- **Build, test, run, and version-control commands** — e.g. `mvnw`, `docker`, `java`, `git`, `npm`, `sdk`, and equivalent build/test/run/VCS tooling.
- **Reading or searching non-source-code files** — Markdown, YAML, JSON, and other config/doc formats, including this package's own `.apm/` sources, `apm.yml`, and stats/export files (e.g. codeburn exports).

## 4. Failure Modes and Fallback Protocol (Source Code)
If Serena cannot be used, returns an error, or yields an empty result for a symbol search in source code, apply the following fallback logic:
1. **Query Refinement:** Attempt to broaden or fuzzy-match the query inside Serena first (e.g., searching for partial symbol/class names).
2. **Explicit Justification:** If you must fall back to native tools (like `grep` or `cat`) for source code, state the exact technical reason or tool limitation in one concise sentence before executing the fallback command.
3. **Scope Limitation:** If forced to use native `grep` on source code, restrict the search scope to a specific, highly-targeted subdirectory rather than a repository-wide scan.

## 5. Delegating Source Exploration to Another Agent
When delegating work that involves source-code exploration to another agent via the Agent/Task tool, the delegation prompt you author MUST include the Serena-first guidance above and the allowed-fallback boundary from Section 3, so that guidance reaches the delegated agent even if it does not receive this file directly.

---