import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      // Construction lancée à côté du serveur de développement (`next.config.ts`).
      ".next-build/**",
      // Et tout serveur de développement lancé par un agent sur son port, avec
      // son propre `NEXT_DIST_DIR` (`.next-2d`, `.next-ia`…).
      ".next-*/**",
      // Les worktrees des agents portent leurs propres bundles : rien à y inspecter.
      ".claude/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
