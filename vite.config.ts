import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
export default defineConfig(({ mode }) => ({
  // Every SFC compiles in custom-element mode so its <style scoped> block is
  // injected into the <esr-workspace> shadow root instead of document.head.
  plugins: [vue({ customElement: true })],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:5080",
      "/health": "http://127.0.0.1:5080",
    },
  },
  build:
    mode === "component"
      ? {
          outDir: "dist/component",
          lib: {
            entry: "src/index.ts",
            formats: ["es"],
            fileName: () => "esr-workspace.js",
          },
        }
      : { outDir: "dist/host" },
  test: { include: ["tests/**/*.test.ts"], environment: "happy-dom" },
}));
