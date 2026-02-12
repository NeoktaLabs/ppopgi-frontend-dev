// src/main.tsx
import * as buffer from "buffer";

// ✅ Must exist before Ledger libs are dynamically imported later
const g: any = globalThis;
if (!g.Buffer) g.Buffer = buffer.Buffer;
if (!g.global) g.global = g;

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ThirdwebProvider } from "thirdweb/react";
import { thirdwebClient } from "./thirdweb/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThirdwebProvider client={thirdwebClient}>
      <App />
    </ThirdwebProvider>
  </StrictMode>
);