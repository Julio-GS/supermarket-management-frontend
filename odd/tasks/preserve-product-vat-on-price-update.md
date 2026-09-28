# Preserve product VAT on price update

## Goal
Ensure product updates send the product's existing backend-defined VAT rate instead of replacing it with `0.00`.

## Scope
- Extend the update contract with the product VAT rate.
- Forward the selected product VAT through the edit flow.
- Add regression coverage for the API payload.

## Tasks
- [x] Update the product update contract and edit flow to preserve VAT.
- [x] Add and run focused regression tests for the update payload.
- [x] Make the persisted VAT mandatory in the update contract and remove the `0.00` fallback.

## Evidence
- `UpdateProductInput` now carries the existing VAT rate through the edit flow.
- The API update payload formats 21% as `"21.00"` and 10.5% as `"10.50"`.
- Focused repository suite: 26 tests passed.
- Products module suite: 216 tests passed.
- Production build passed.
- Independent verification: 106 focused tests passed, `tsc --noEmit` completed without diagnostics, and `git diff --check` passed.
- The cashier-facing edit form exposes no VAT control; missing/invalid persisted VAT blocks submission instead of inventing a rate.
- Behavior commit: `9105a1a` (`fix(productos): preserve configured IVA on price updates`).
