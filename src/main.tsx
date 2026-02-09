// src/main.tsx

import { Buffer } from "buffer";

// ✅ Ledger + ethers expect these globals (Vite doesn't polyfill them by default)
const g: any = globalThis as any;

if (!g.Buffer) g.Buffer = Buffer;
if (!g.global) g.global = g;

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ThirdwebProvider } from "thirdweb/react";

// ✅ Prevent thirdweb auto-restore issues (optional, but fine)
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k) continue;
    const v = localStorage.getItem(k) ?? "";
    if (k.toLowerCase().includes("thirdweb") && v.toLowerCase().includes("injected")) {
      localStorage.removeItem(k);
    }
  }
} catch {}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThirdwebProvider autoConnect={false}>
      <App />
    </ThirdwebProvider>
  </StrictMode>
);