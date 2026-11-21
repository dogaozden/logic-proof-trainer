import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
// `--mode web` builds the browser version: Tauri's IPC is replaced by src/web/invoke.ts
// (logic-core as WebAssembly + localStorage), with relative asset paths.
export default defineConfig(async ({ mode }) => ({
  plugins: [react()],
  ...(mode === "web"
    ? {
        base: "./",
        resolve: {
          alias: { "@tauri-apps/api/core": fileURLToPath(new URL("./src/web/invoke.ts", import.meta.url)) },
        },
      }
    : {}),

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
