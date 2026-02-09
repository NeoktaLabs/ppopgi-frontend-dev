// src/main.tsx
import * as buffer from "buffer";

// ✅ Ledger + ethers expect these globals
if (!(window as any).Buffer) {
  (window as any).Buffer = buffer.Buffer;
}
if (!(window as any).global) {
  (window as any).global = window;
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ThirdwebProvider } from "thirdweb/react";

// ✅ Prevent thirdweb auto-restore issues
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