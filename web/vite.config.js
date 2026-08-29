import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  server: {
    fs: { allow: [resolve(here, ".."), here] },
    proxy: { "/api": { target: "http://localhost:4173", changeOrigin: true } },
  },
  build: {
    outDir: resolve(here, "dist"),
    emptyOutDir: true,
    target: "es2022",
  },
});
