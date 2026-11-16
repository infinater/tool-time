import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // 版本号只维护 package.json 一处，其余由构建注入
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  clearScreen: false,
  server: {
    port: 5183,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**", "**/.shots/**", "**/dist/**", "**/.*.tmpdir/**", "**/*.tmp", "**/design/**"],
    },
  },
  build: {
    target: "chrome110",
    outDir: "dist",
  },
});
