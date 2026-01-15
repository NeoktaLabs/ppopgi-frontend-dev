import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { WalletProviders } from "./lib/wallet";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <WalletProviders>
    <App />
  </WalletProviders>
);