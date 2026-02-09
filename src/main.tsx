// src/main.tsx
import { Buffer } from "buffer";

// ✅ Ledger libs expect Buffer/global in browser
if (!(window as any).Buffer) (window as any).Buffer = Buffer;
if (!(window as any).global) (window as any).global = window;

// ✅ IMPORTANT: if you previously used walletId "injected", thirdweb may try to auto-restore it.
// Purge any stored thirdweb session that mentions "injected".
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k) continue;
    const v = localStorage.getItem(k) ?? "";
    // be conservative: only clean thirdweb-ish keys or any value referencing injected
    if (k.toLowerCase().includes("thirdweb") && v.toLowerCase().includes("injected")) {
      localStorage.removeItem(k);
    }
    if (v === "injected") {
      localStorage.removeItem(k);
    }
  }
} catch {
  // ignore storage errors
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

import { ThirdwebProvider } from "thirdweb/react";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* ✅ disable provider-level auto connect */}
    <ThirdwebProvider autoConnect={false}>
      <App />
    </ThirdwebProvider>
  </StrictMode>
);