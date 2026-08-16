import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-config-prettier";

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
      "out/**",
      "build/**",
      "next-env.d.ts",
      // The Expo app is a self-contained project with its own toolchain
      // (its own tsconfig, its own `expo lint`). Linting it with the web
      // app's Next.js config reports errors against React Native conventions
      // it was never meant to satisfy.
      "mobile/**",
    ],
  },
  prettier,
];

export default eslintConfig;
