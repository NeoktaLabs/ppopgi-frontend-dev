// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],

  // Some ledger deps reference `global`
  define: {
    global: "globalThis",
  },

  // Make sure Buffer is injected during dependency pre-bundling
  optimizeDeps: {
    include: ["buffer", "@ledgerhq/hw-transport-webhid", "@ledgerhq/hw-app-eth"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
      inject: [resolve("node_modules/buffer/index.js")],
    },
  },
});