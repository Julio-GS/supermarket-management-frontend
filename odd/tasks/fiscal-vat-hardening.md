# Fiscal VAT Hardening

## Objective
Prevent the POS from attempting fiscal checkout when any catalog item has an unsupported VAT rate, while assigning ad-hoc items a default 10.5% VAT rate.

## Problem
The sales frontend currently drops product VAT metadata before checkout, fiscal ticket validation checks only authorization fields, and fiscal printing assumes 21%. This allows an invalid 0% product to reach fiscal issuance and makes tax output inaccurate for 10.5% items.

## Why
Fiscal sales must accept only the business-approved VAT rates: 10.5% and 21%. A 0%, missing, malformed, or otherwise unsupported catalog VAT rate must fail before the fiscal request is submitted.

## Scope
- Preserve VAT rates from product API DTOs through the POS catalog and cart.
- Assign ad-hoc sale lines a default VAT rate of 10.5%.
- Validate every line before an invoice-requested checkout is submitted.
- Keep non-fiscal checkout behavior unchanged.
- Carry validated VAT data into printable fiscal tickets and render rate-aware tax totals.
- Cover regular and split fiscal flows with focused Vitest tests.

## Constraints
- Accepted VAT rates are exactly 10.5 and 21.
- Catalog items fail closed on missing, malformed, 0, or unsupported VAT.
- Ad-hoc items use 10.5 by explicit product decision.
- Existing backend request contracts must remain compatible unless the current API types already expose a supported VAT field.
- Technical artifacts remain in English; existing operator-facing Spanish conventions are preserved.

## Execution configuration
- Workflow: Organic Driven Development (delegated direct implementation).
- TDD mode: unknown; test framework presence does not enable strict TDD.
- Verification runner: focused `npm test -- <test paths>` commands, then applicable broader checks.
- Delivery strategy: exception-ok (user explicitly selected one cohesive oversized commit on `feat/fiscal-vat-hardening`).
- Forecast: approximately 250-350 authored changed lines.
- Final working-tree scope: 2,533 changed lines across 24 tracked source/test files plus this task document; this exceeded the forecast because comprehensive regression coverage and multiple fail-closed integration remediations were required.

## Tasks
- [x] **VAT-1 — Preserve and validate line VAT before fiscal submission**
  - Route: delegated writer (4+ files required to understand; 2+ non-trivial files to edit).
  - Preserve normalized product VAT through catalog/cart/checkout models.
  - Default ad-hoc lines to 10.5%.
  - Reject invoice-requested checkout before adapter submission if any catalog line VAT is invalid.
  - Ensure non-fiscal checkout remains unaffected.
  - Checks: focused domain/application/adapter tests covering 0, missing, malformed, unsupported, 10.5, 21, mixed accepted rates, and ad-hoc default.
  - Commit evidence: pending; commits require explicit user authorization.

- [x] **VAT-2 — Build and print fiscal tickets with validated VAT rates**
  - Route: delegated writer (multi-file domain/infrastructure change).
  - Carry VAT rates into ticket snapshots/printable lines.
  - Enforce the same fail-closed rule during fiscal ticket construction, including split tickets and reprints where data is available.
  - Render tax breakdowns by validated rate instead of assuming 21%.
  - Checks: focused ticket-builder and browser-ticket-printer tests.
  - Commit evidence: pending; commits require explicit user authorization.

- [x] **VAT-3 — Verify integrated behavior**
  - Route: delegated verifier as required by the runtime assessment plan.
  - Run focused tests, type/lint checks as applicable, and inspect the final diff for request-boundary enforcement.
  - Record all passing, failed, skipped, or unavailable checks.
  - Commit evidence: pending; commits require explicit user authorization.

## Acceptance criteria
1. Fiscal checkout is not submitted when any catalog product VAT is 0%, missing, malformed, or not exactly 10.5%/21%.
2. Catalog products at 10.5% and 21% are accepted, including a mixed-rate sale.
3. Ad-hoc lines receive a 10.5% VAT rate and may participate in fiscal checkout.
4. Non-fiscal checkout is unaffected by VAT validation.
5. Split fiscal tickets enforce the same line-level rules.
6. Fiscal printed tax details reflect the actual validated rates rather than a hardcoded 21%.
7. The operator receives a deterministic, actionable error and no checkout adapter call occurs for rejected fiscal sales.

## Progress
- Exploration completed: VAT is present in backend product DTOs but was discarded by frontend mappings; fiscal rendering assumed 21%.
- Product decision confirmed: validate each catalog product and default ad-hoc items to 10.5%.
- VAT-1 completed: VAT now propagates through product, catalog, cart, checkout, and sale models; invoice-requested checkout fails before adapter submission for invalid catalog VAT; ad-hoc items default to 10.5%; non-fiscal sales remain unaffected.
- VAT-2 completed: fiscal ticket construction validates VAT for regular, split, and reprint flows; browser printing groups net and VAT totals by 10.5% and 21%.
- VAT-3 remediation completed:
  - Fixed inline desktop/normalized sale item type in `api-sales-repository.ts` so `iva` and `kind` access are type-correct.
  - Hardened VAT parsing in `api-product-repository.ts`, `api-checkout-adapter.ts`, and `api-sales-repository.ts` to strictly match ordinary decimal strings (`/^\d+(?:\.\d+)?$/`) and numbers, rejecting hex (`0x15`), binary, octal, exponent notation (`2.1e1`), partial strings (`21.00foo`), NaN, and infinities.
  - Removed all inference of item kind from display `name`, description, or draft position: equal lengths are not identity.
  - Normalized checkout response item provenance only via valid explicit `dto.kind`, exactly like historical response normalization (`parseSaleItemKind`).
  - Sales history, retry, desktop, and checkout response normalization preserve only explicit wire/bridge `kind` values ("catalog" | "ad-hoc") and leave missing/invalid wire values unknown (`undefined`).
  - Historical ad-hoc items with explicit VAT 10.5 remain printable without fallback; historical items with explicit `kind: "ad-hoc"` receive the 10.5 fallback; items with unknown origin and missing VAT fail closed on fiscal reprint.
  - Verified live fiscal printing derives authoritative VAT directly from the active cart/snapshot path (`ci.product.iva` and `ci.iva ?? 10.5`), keeping live tickets correct without correlation guesses.
  - Added comprehensive regression tests across checkout adapter, domain ticket builder, sales repository, and POS terminal test suites.

## Verification evidence
- Final fail-closed focused tests: `npm test -- src/modules/ventas/infrastructure/__tests__/api-checkout-adapter.test.ts src/modules/ventas/presentation/__tests__/use-pos-terminal.test.tsx` — passed, 109 tests across 2 suites.
- Final fail-closed linter: `npm run lint -- --quiet` — passed with zero errors or warnings.
- Remediation focused tests: `npm test -- src/modules/ventas/infrastructure/__tests__/catalog-query-adapter.test.ts src/modules/ventas/infrastructure/__tests__/api-sales-repository.test.ts src/modules/ventas/infrastructure/__tests__/api-checkout-adapter.test.ts src/modules/ventas/domain/__tests__/ticket-builder.test.ts` — passed, 99 tests across 4 suites.
- Remediation linter: `npm run lint -- --quiet` — passed with zero errors or warnings.
- Writer: `npm test -- src/modules/ventas/application/__tests__/use-pos-checkout.test.ts src/modules/ventas/domain/__tests__/ticket-builder.test.ts src/modules/ventas/infrastructure/__tests__/browser-ticket-printer.test.ts` — passed, 115 tests.
- Writer: `npm run lint -- --quiet` — passed with zero errors or warnings.
- Parent: `git diff --check` — passed; line-ending conversion warnings only.
- Native assessment: unavailable (`package-local-binary-missing`); treated as high risk and routed to independent verification.
- Second remediation focused tests: `npm test -- src/modules/productos/infrastructure/__tests__/api-product-repository.test.ts src/modules/ventas/infrastructure/__tests__/api-checkout-adapter.test.ts src/modules/ventas/infrastructure/__tests__/api-sales-repository.test.ts src/modules/ventas/domain/__tests__/ticket-builder.test.ts` — passed, 115 tests across 4 suites.
- Second remediation linter: `npm run lint -- --quiet` — passed with zero errors or warnings.
- Final provenance focused tests: `npm test -- src/modules/ventas/infrastructure/__tests__/api-checkout-adapter.test.ts src/modules/ventas/infrastructure/__tests__/api-sales-repository.test.ts src/modules/ventas/domain/__tests__/ticket-builder.test.ts` — passed, 97 tests across 3 suites.
- Final provenance linter: `npm run lint -- --quiet` — passed with zero errors or warnings.
- Parent controlled compiler spot-check: `npx tsc --noEmit` — passed; generated `tsconfig.tsbuildinfo` was restored to its pre-check state.
- Final independent verification: passed with no deterministic findings; 298 tests across 8 focused suites and lint passed.
- Final parent structural check: `git diff --check` — passed; line-ending conversion warnings only.

## Next step
Implementation and verification are complete. No commit or PR action was taken; delivery strategy must be selected before committing this oversized change.
