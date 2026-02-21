# Glyte Codebase Audit — Consolidated Report

**Date**: 2026-02-20
**Scope**: ~75 files, ~10K LOC (Next.js 16 + DuckDB + AI SDK)
**Auditors**: 6 parallel perspectives (Backend, Frontend, Security, Architecture, Database, Design/UX)

---

## Executive Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| **Critical** | 6 | SQL injection (4 vectors), arbitrary file read, zero accessibility |
| **High** | 12 | No auth, no CORS, prompt injection, silent errors, monolith components, OOM risk |
| **Medium** | 22 | DRY violations, missing transactions, hardcoded config, type safety gaps |
| **Low** | 15 | Test coverage, BigInt precision, BOM, minor UX gaps |
| **Positive** | 30+ | Strong SQL utils foundation, good connection pool, URL-synced filters, type safety |

**Bottom line**: Glyte has a solid architectural foundation (clean layer separation, good SQL utils, pragmatic DuckDB pool). The critical issues are concentrated around **inconsistent application of existing security patterns** — the tools exist (`quoteIdent`, `BLOCKED_SQL`, `safeCsvPath`) but aren't used everywhere. Fixing the top 5 issues closes ~80% of the risk.

---

## Top 10 Findings (Cross-Perspective, Prioritized by Impact)

### 1. CRITICAL — SQL Injection via Raw Query Endpoint
**Detected by**: Backend, Security, Database, Architecture (4/6 auditors)
**Files**: `src/app/api/dashboard/[id]/query/route.ts:11-23`, `src/mcp/server.ts`
**Issue**: Accepts raw SQL from client with only a `^\s*SELECT\b` regex check. DuckDB's `read_csv_auto('/etc/passwd')` passes this check, enabling **arbitrary file reads** from the server filesystem. The MCP `query_dashboard` tool has the same weakness.
**Irony**: The analyst-agent in the SAME codebase has a proper `BLOCKED_SQL` regex — it just isn't applied to the direct query endpoint.
**Fix**: Apply `BLOCKED_SQL` regex + block DuckDB file functions (`read_csv_auto`, `read_parquet`, `read_json_auto`). Add `enable_external_access=false` to DuckDB config. Estimated: ~20 lines changed.
**Impact**: If deployed publicly, full filesystem readable via crafted SQL.

### 2. CRITICAL — SQL Injection in profiler.ts (Auto-Triggered)
**Detected by**: Backend, Database, Architecture (3/6 auditors)
**Files**: `src/lib/profiler.ts:34,50-53,79,89,97`
**Issue**: Column names from user-uploaded CSV headers interpolated as `"${colName}"` instead of `${quoteIdent(colName)}`. **Triggered automatically on every CSV upload** — no user interaction needed beyond uploading a file.
**Fix**: Replace all `"${colName}"` with `${quoteIdent(colName)}` in profiler.ts. ~6 replacements.
**Impact**: Crafted CSV column name = arbitrary SQL execution on upload.

### 3. CRITICAL — SQL Injection in Chart Recommender & Templates
**Detected by**: Database, Architecture (2/6 auditors)
**Files**: `src/lib/chart-recommender.ts:262,271`, 5 template files, `src/lib/semantic-layer.ts:98-133`
**Issue**: Table names used as `"${profile.tableName}"` without `quoteIdent()`. Partially mitigated by upload sanitization reducing names to `[a-zA-Z0-9_]`, but defense-in-depth is violated.
**Fix**: Apply `quoteIdent()` to all dynamic table/column names. ~15 replacements across files.
**Impact**: Lower than #1-2 due to upload sanitization, but still a bypass risk.

### 4. CRITICAL — DuckDB External Access Enabled
**Detected by**: Security
**Files**: DuckDB initialization (no `enable_external_access=false`)
**Issue**: DuckDB can read arbitrary files from the filesystem via SQL functions. Combined with finding #1, this is the actual attack vector enabling file reads.
**Fix**: Add `PRAGMA enable_external_access=false` or equivalent config. 1 line.
**Impact**: Closes the filesystem read vector from finding #1 at the database level.

### 5. CRITICAL — Zero Accessibility
**Detected by**: Design/UX
**Files**: All 25 components
**Issue**: No ARIA attributes, no keyboard navigation, no focus management, no focus-visible indicators, no `role` attributes anywhere in the codebase. Modals have no focus trap. Charts have no alt text.
**Fix**: Systematic accessibility pass. Start with modals (focus trap), then interactive elements (buttons need labels), then charts (aria-label).
**Impact**: Unusable for keyboard/screen-reader users. Potential legal compliance issue if deployed commercially.

### 6. HIGH — No Authentication / No CORS
**Detected by**: Security
**Files**: No `middleware.ts` exists. No CORS config in `next.config.ts`.
**Issue**: All 18 API routes are publicly accessible. No auth middleware, no session handling, no API keys. Any origin can call any endpoint. Combined with #1, any website can execute SQL on a running Glyte instance via CSRF.
**Fix**: Add Next.js middleware with auth check. Add CORS headers. Scope depends on deployment model (local-only vs hosted).
**Impact**: If deployed beyond localhost — full data exposure.

### 7. HIGH — Prompt Injection via CSV Column Names
**Detected by**: Security
**Files**: Analyst agent, classification prompts
**Issue**: CSV column names (user-controlled) are interpolated directly into LLM system prompts. A crafted column name like `"name; IGNORE ALL PREVIOUS INSTRUCTIONS"` could manipulate AI responses.
**Fix**: Sanitize column names before prompt interpolation. Use structured tool inputs instead of string interpolation.
**Impact**: AI responses manipulated, potential data exfiltration via AI output.

### 8. HIGH — Silent Error Swallowing (10+ instances)
**Detected by**: Frontend, Architecture
**Files**: `src/components/table-manager.tsx:67,100,112,127,165`, `src/app/dashboard/[id]/page.tsx:165,215,284`, `src/app/page.tsx:177`, `src/components/lead-gen-section.tsx:125`
**Issue**: Empty `catch {}` blocks on network requests. Column toggles, relationship operations, table deletes fail completely silently. UI stays in inconsistent state.
**Fix**: Add `console.error` + user-facing toast/error state in each catch.
**Impact**: Users think actions succeeded when they failed. Data inconsistency.

### 9. HIGH — Dashboard Page Monolith (537 LOC)
**Detected by**: Frontend, Architecture
**Files**: `src/app/dashboard/[id]/page.tsx:38-537`
**Issue**: 13 `useState` hooks, 9 `useCallback` handlers, 5 modal state booleans, all in one component. The "add table" flow alone is 150 lines.
**Fix**: Extract `useAddTable()` hook, `DashboardHeader` component, replace 5 modal booleans with `activeModal` enum.
**Impact**: Hard to maintain, test, or extend. High cognitive load.

### 10. HIGH — Export Loads Entire Table Into Memory
**Detected by**: Database
**Files**: `/api/dashboard/[id]/export` route
**Issue**: Export loads the entire DuckDB table into JS memory before writing response. On large datasets (100K+ rows), this causes OOM.
**Fix**: Stream export using DuckDB's `COPY TO` or chunked reads.
**Impact**: Server crash on large dataset export.

---

## All Findings by Perspective

### Backend Audit
| # | Severity | Finding | File |
|---|----------|---------|------|
| B1 | Critical | SQL injection in profiler.ts — unquoted column names | `profiler.ts:34,50-53,79,89,97` |
| B2 | Critical | Raw SQL query endpoint — weak SELECT check | `api/.../query/route.ts:11-23` |
| B3 | Critical | Unvalidated table names in export/lead-gen-stats | `api/.../export/`, `api/.../lead-gen-stats/` |
| B4 | High | Missing BLOCKED_SQL in direct query vs analyst-agent | `query/route.ts` vs `analyst-agent.ts` |
| B5 | High | Inconsistent error response formats | Multiple API routes |
| B6 | High | No request size limits | All POST routes |
| B7 | High | MCP server bypasses validation | `mcp/server.ts` |
| B8 | High | Query timeout doesn't cancel DuckDB query | `query/route.ts` |
| B9-B16 | Medium | Various: missing field validation, type coercion, connection handling edge cases | Multiple files |
| B17-B22 | Low | Various: response format inconsistencies, missing headers | Multiple files |

### Frontend Audit
| # | Severity | Finding | File |
|---|----------|---------|------|
| F1 | High | Dashboard page monolith (537 LOC, 13 state vars) | `dashboard/[id]/page.tsx` |
| F2 | High | Silent catch {} blocks (10 instances) | Multiple components |
| F3 | High | useFilterStore causes unnecessary re-renders | `store/filters.ts`, `auto-chart.tsx` |
| F4 | High | No top-level error boundary | `layout.tsx` |
| F5 | Medium | ai-sidebar sendMessage stale dependency on messages | `ai-sidebar.tsx:50-169` |
| F6 | Medium | `any` type in auto-chart getPayload | `auto-chart.tsx:102` |
| F7 | Medium | index-as-key in 7 locations | Multiple components |
| F8 | Medium | table-manager fetchColumns dependency causes re-renders | `table-manager.tsx:59-68` |
| F9 | Medium | handleHideChart defeats memo on ChartCard | `chart-grid.tsx:32-44` |
| F10 | Medium | Duplicated formatTitle function | `dimension-chart.tsx:19`, `dimension-pills.tsx:26` |
| F11 | Medium | Duplicated export download logic | `enrichment-board.tsx`, `export-panel.tsx` |
| F12 | Medium | AiProvider context value not memoized | `ai-provider.tsx:33` |
| F13-F17 | Low | SQL escaping on client, missing aria-label, no error boundary reset, missing AbortController cleanup | Multiple |

### Security Audit
| # | Severity | Finding | File |
|---|----------|---------|------|
| S1 | Critical | Raw SQL → DuckDB file reads (read_csv_auto('/etc/passwd')) | `query/route.ts` |
| S2 | Critical | MCP server same vulnerability | `mcp/server.ts` |
| S3 | Critical | csvPath accepted without safeCsvPath() at API layer | `tables/route.ts:32` |
| S4 | High | Zero authentication across 18 routes | No middleware.ts |
| S5 | High | No CSRF/CORS protection | `next.config.ts` |
| S6 | High | Prompt injection via CSV column names in LLM prompts | Agent/classify routes |
| S7 | High | DuckDB without enable_external_access=false | DuckDB init |
| S8 | High | Inconsistent safeErrorMessage() usage (2 of 15 handlers) | Multiple routes |
| S9-S14 | Medium | Missing DuckDB function blocklist, filesystem paths leaked, table name collisions, unvalidated enums, no rate limiting, no security headers | Multiple |
| S15-S17 | Low | No upload size limit, missing CSV BOM, query timeout doesn't cancel | Multiple |

### Architecture Audit
| # | Severity | Finding | File |
|---|----------|---------|------|
| A1-3 | Critical | SQL injection (same as B1, B2, B3) | profiler, chart-recommender, templates |
| A4 | High | DASHBOARDS_DIR duplicated in 5+ files | Multiple lib files |
| A5 | High | process.cwd() hardcoded 18 times | Multiple files |
| A6 | High | AiMode type imported from client component into server code | Cross-boundary import |
| A7 | High | 4 silent empty catch {} blocks | Multiple |
| A8 | High | formatTitle() duplicated 5 times | Multiple components |
| A9 | High | normalizeColName duplicated | Multiple files |
| A10 | High | No rate limiting on AI chat endpoint | `api/.../chat/` |
| A11-A19 | Medium | God components, duplicated config I/O, inconsistent error formats, MCP bypassing dashboard-loader, hardcoded Kea presets | Multiple |
| A20-A25 | Low | Thin test coverage (3 files for 17 modules), MCP excluded from TS compilation, no .env.example, hardcoded version | Multiple |

### Database Audit
| # | Severity | Finding | File |
|---|----------|---------|------|
| D1 | Critical | SQL injection via raw query (same as S1) | `query/route.ts` |
| D2 | Critical | SQL injection in profiler (same as B1) | `profiler.ts` |
| D3 | Critical | SQL injection in chart-recommender/templates | `chart-recommender.ts`, templates |
| D4 | High | Export loads entire table into memory — OOM risk | `export/route.ts` |
| D5 | High | Query timeout doesn't cancel DuckDB query | `query/route.ts` |
| D6 | High | Connection pool has no upper bound | `duckdb.ts` |
| D7 | High | MCP query same weak check | `mcp/server.ts` |
| D8 | Medium | Migration runner lacks transaction wrapping | Migrations |
| D9 | Medium | _glyte_versions INSERT silently swallowed on first boot | Version management |
| D10 | Medium | appendCsv multi-step operation has no transaction | `duckdb.ts` |
| D11 | Medium | buildSafeWhereClause uses hand-rolled escaping | SQL construction |
| D12-D14 | Medium | Auto-increment missing, no indexes on system tables, temp table cleanup | Multiple |
| D15-D19 | Low | BigInt precision, CSV BOM, WAL PRAGMA syntax, ID collision, no corruption recovery | Multiple |

### Design/UX Audit
| # | Severity | Finding | File |
|---|----------|---------|------|
| U1 | Critical | Zero ARIA attributes across entire codebase | All 25 components |
| U2 | Critical | No keyboard navigation or focus management | All components, modals |
| U3 | High | Mixed gray/slate color palettes, no design tokens | Multiple components |
| U4 | High | Desktop-only layout, no responsive breakpoints | Multiple components |
| U5 | High | 6 modals with duplicated structure, no shared base | Modal components |
| U6 | High | No loading skeletons for data-fetching components | Multiple |
| U7-U14 | Medium | Duplicated COLORS arrays, tooltip styles, filter state loss on reload, version history missing backdrop, etc. | Multiple |
| U15-U20 | Low | Error color inconsistency, mixed border-radius, micro text readability, etc. | Multiple |

---

## Positive Patterns (Worth Keeping)

These are strong foundations that the fixes should build upon, not replace:

| Pattern | Where | Why It's Good |
|---------|-------|--------------|
| `quoteIdent()` / `quoteLiteral()` | `sql-utils.ts` | Proper SQL escaping — just needs consistent usage |
| `safeCsvPath()` allowlist | `duckdb.ts` | Prevents path traversal — correct approach |
| `sanitizeDashboardId()` strict regex | `duckdb.ts` | Only allows `dash-\d+` format |
| `safeUploadFilename()` | Upload handling | Prevents path traversal in filenames |
| `BLOCKED_SQL` regex in analyst-agent | `analyst-agent.ts` | Comprehensive SQL blocklist — needs to be shared |
| Connection pool with discard-on-error | `duckdb.ts` | `releaseConnection(conn, bad)` pattern |
| `ALLOWED_PATCH_KEYS` whitelist | Dashboard PATCH route | Prevents mass assignment |
| Clean layer separation | Overall architecture | Components never import from lib directly |
| URL-synced filter state | `store/filters.ts` | Shareable, survives refresh |
| `ChartErrorBoundary` per chart | `chart-grid.tsx` | Correct granularity — one chart failure doesn't kill all |
| Proper AbortController usage | `dimension-chart.tsx` | Textbook cleanup pattern |
| Strong TypeScript types | `types/dashboard.ts` | No `any`, proper unions |
| `server-only` import guards | Server modules | Prevents client-side import of server code |

---

## Recommended Fix Order

| Priority | Findings | Effort | Impact |
|----------|----------|--------|--------|
| **P0 — Now** | #1 Raw SQL endpoint + #4 DuckDB external access | ~30 min | Closes critical file-read vulnerability |
| **P1 — This week** | #2 profiler.ts quoteIdent, #3 chart-recommender quoteIdent | ~1 hour | Closes all SQL injection vectors |
| **P2 — This week** | #6 Auth middleware (if deploying beyond localhost) | ~2-4 hours | Closes unauthorized access |
| **P3 — Next sprint** | #7 Prompt injection sanitization, #8 Silent errors, #10 Export streaming | ~1 day | Stability + security hardening |
| **P4 — Backlog** | #5 Accessibility, #9 Dashboard refactor, Design tokens, Responsive | ~3-5 days | UX quality + maintainability |

---

## Deduplicated Finding Count (After Cross-Perspective Merge)

| Severity | Unique Findings |
|----------|----------------|
| Critical | **6** (4 SQL injection vectors + DuckDB external access + accessibility) |
| High | **12** (auth, CORS, prompt injection, silent errors, monolith, re-renders, error boundary, OOM export, pool unbounded, rate limiting, duplicated constants, design tokens) |
| Medium | **~22** (DRY violations, missing transactions, type safety, config management, etc.) |
| Low | **~15** (test coverage, BigInt, BOM, minor UX, etc.) |
| **Total unique** | **~55** |
