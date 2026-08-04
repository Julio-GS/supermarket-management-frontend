import next from "eslint-config-next"

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...next,
  {
    name: "hexagonal/cross-domain",
    files: ["src/modules/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*/*/**"],
              message:
                "Cross-domain imports must go through the module's public index.ts (e.g., @/modules/auth). Use relative imports within the same module.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "hexagonal/ui-to-infra",
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "src/modules/**/presentation/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*/*/**"],
              message:
                "UI must import modules through their public index.ts only (e.g., @/modules/auth).",
            },
            {
              group: [
                "@/modules/*/infrastructure/*",
                "@/modules/*/infrastructure/**",
                "*/infrastructure/*",
                "**/infrastructure/*",
                "**/infrastructure/**",
              ],
              message:
                "Presentation/UI must not import infrastructure directly. Use the module's public API or application layer.",
            },
            {
              group: ["@/lib/data", "@/lib/data.ts"],
              message: "Legacy lib/data.ts is deprecated. Use domain module APIs.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "hexagonal/domain-purity",
    files: ["src/modules/**/domain/**/*.{ts,tsx}", "src/shared/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "Domain files must not import React." },
            { name: "react-dom", message: "Domain files must not import React DOM." },
            { name: "next", message: "Domain files must not import Next.js." },
            { name: "sonner", message: "Domain files must not import sonner." },
            { name: "recharts", message: "Domain files must not import recharts." },
          ],
          patterns: [
            {
              group: [
                "@/components/**",
                "@/hooks/**",
                "@/lib/**",
                "@/modules/*/application/**",
                "@/modules/*/infrastructure/**",
                "@/modules/*/presentation/**",
              ],
              message: "Domain files must remain framework-free and layer-free.",
            },
          ],
        },
      ],
    },
  },
]

export default eslintConfig
