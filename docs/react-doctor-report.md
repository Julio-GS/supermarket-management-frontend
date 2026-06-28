Fix the top 3 React Doctor issues in supermarket-management-frontend on this pass ÔÇö leave the rest for a follow-up.

1. WARN Performance: Heavy library loaded eagerly (├ù2)
   "recharts" ships extra code to your users up front & slows page load. Load it on demand with React.lazy() or next/dynamic.
   Curl with no cache & follow the canonical fix and false positive check recipe before fixing: https://react.doctor/docs/rules/react-doctor/prefer-dynamic-import
   - components/ui/chart.tsx:5
   - src/modules/reportes/presentation/sales-chart.tsx:3
2. WARN Accessibility: Role used instead of HTML tag (├ù5)
   Screen reader users get more reliable semantics from `<address>` than `role="group"`, so use `<address>` instead.
   Curl with no cache & follow the canonical fix and false positive check recipe before fixing: https://react.doctor/docs/rules/react-doctor/prefer-tag-over-role
   - components/ui/field.tsx:79
   - components/ui/input-group.tsx:15
   - src/modules/ventas/presentation/pos-terminal.tsx:170
3. WARN Maintainability: Multiple components in one file (├ù2)
   This file declares several components, so each component is harder to find, test, and change.
   Curl with no cache & follow the canonical fix and false positive check recipe before fixing: https://react.doctor/docs/rules/react-doctor/no-multi-comp
   - components/ui/input-group.tsx:46

Full results for all 16 issues (diagnostics.json + a .txt per rule): C:\Users\olyce\AppData\Local\Temp\react-doctor-7d957be9-7279-4dc8-8354-f591ad685c99

Read each file and fix the root cause ÔÇö don't suppress or silence the rule.

Findings that share a `fixGroupId` (in diagnostics.json) are one root cause ÔÇö a single fix clears all of them, so treat each `fixGroupId` as ONE task, not one per site.

Verify against the real thing, don't assume: confirm each change matches the canonical fix recipe you fetched for that rule, then re-run `npx react-doctor@latest --verbose` and check the issue is actually gone against the real tool before moving on.

Teach me as you go: for every issue you touch, explain it in plain language (no jargon) ÔÇö what the problem is, why it's a problem, and how serious it is in human terms. Describe the real-world impact and severity concretely (e.g. "this crashes the page for users on Safari" vs. "this is a minor cleanup with no user impact") so I understand why it matters, not just what changed.

Then work through the rest from the full results above.
