import js from "@eslint/js";
import tseslint from "typescript-eslint";
import vue from "eslint-plugin-vue";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "artifacts/**",
      "test-results/**",
      "playwright-report/**",
      "backend/**/bin/**",
      "backend/**/obj/**",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.{js,mjs,ts,vue}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, extraFileExtensions: [".vue"] },
    },
  },
);
