import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
export default defineConfig(({ mode }) => ({
  plugins: [vue({ customElement: /\.ce\.vue$/ })],
  // Host-only static files (the DOOM shareware bundle) never enter the component build.
  publicDir: mode === "component" ? false : "host/public",
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
      : {
          outDir: "dist/host",
          rollupOptions: { input: { main: "index.html", doom: "doom.html" } },
        },
  test: { include: ["tests/**/*.test.ts"], environment: "happy-dom" },
}));
