import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["coverage/**", "dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["umbra-extension/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        chrome: "readonly",
      },
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          varsIgnorePattern:
            "^(surfaceFamilyForReason|clearTimers|currentPointerElement)$",
        },
      ],
    },
  },
  {
    files: [
      "eslint.config.js",
      "vitest.config.js",
      "scripts/**/*.mjs",
      "test/**/*.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
];
