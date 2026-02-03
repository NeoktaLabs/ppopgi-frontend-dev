// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app/styles/globals.css";
import App from "./app/App";

import { ThirdwebProvider } from "thirdweb/react";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThirdwebProvider>
      <App />
    </ThirdwebProvider>
  </StrictMode>
);
