// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";

// If TS complains about these imports, ensure:
//   npm i -D @types/node
export default defineConfig({
  plugins: [react()],

  define: {
    global: "globalThis",
  },

  // ✅ Do NOT alias "buffer" (can trigger default-export issues)
  resolve: {
    alias: {
      process: "process/browser",
    },
  },

  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true,
          process: true,
        }),
        NodeModulesPolyfillPlugin(),
      ],
    },
  },
});