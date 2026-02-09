// src/main.tsx
import { Buffer } from "buffer";

// ✅ Fix: Ledger libs expect Buffer/global in browser (Vite doesn't polyfill by default)
if (!(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}
if (!(window as any).global) {
  (window as any).global = window;
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

import { ThirdwebProvider } from "thirdweb/react";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThirdwebProvider>
      <App />
    </ThirdwebProvider>
  </StrictMode>
);