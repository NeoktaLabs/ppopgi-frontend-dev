// src/components/SignInModal.tsx
import { useEffect, useMemo, useState } from "react";
import { useSession } from "../state/useSession";
import {
  ConnectEmbed,
  useActiveAccount,
  useActiveWallet,
  useConnect,
  useDisconnect,
} from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { useLedgerUsbWallet } from "../hooks/ledgerUsbWallet";
import "./SignInModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SignInModal({ open, onClose }: Props) {
  const setSession = useSession((s) => s.set);
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();

  const { connect, isConnecting, error: connectError } = useConnect({ client: thirdwebClient });

  const {
    ensureLedgerDevice,
    connectLedgerUsb,
    isSupported: isLedgerSupported,
    isConnecting: isLedgerConnecting,
    error: ledgerError,
  } = useLedgerUsbWallet();

  const [localError, setLocalError] = useState("");

  const errorMessage = useMemo(() => {
    return localError || ledgerError || (connectError ? String(connectError.message || connectError) : "") || "";
  }, [localError, ledgerError, connectError]);

  useEffect(() => {
    if (!open) return;
    if (!account?.address) return;

    setSession({
      account: account.address,
      connector: "thirdweb",
    });

    const t = setTimeout(() => onClose(), 500);
    return () => clearTimeout(t);
  }, [account?.address, open, onClose, setSession]);

  useEffect(() => {
    if (open) setLocalError("");
  }, [open]);

  const onConnectLedgerUsb = async () => {
    setLocalError("");
    if (!isLedgerSupported) {
      setLocalError("Ledger USB requires Chrome/Edge/Brave (WebHID).");
      return;
    }

    try {
      // Must be called from user gesture
      await ensureLedgerDevice();

      await connect(async () => {
        const w = await connectLedgerUsb({
          client: thirdwebClient,
          chain: ETHERLINK_CHAIN,
          // uses default path or whatever your hook defaults to
        });
        return w;
      });
    } catch (e: any) {
      setLocalError(e?.message ? String(e.message) : "Failed to connect Ledger.");
    }
  };

  if (!open) return null;

  return (
    <div className="sim-overlay" onMouseDown={onClose}>
      <div className="sim-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sim-header">
          <div>
            <h2 className="sim-title">Welcome to Ppopgi</h2>
            <div className="sim-subtitle">Connect your wallet to start playing</div>
          </div>
          <button className="sim-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="sim-body">
          {/* Ledger Section */}
          <div className="sim-ledger-section">
            <button
              className="sim-ledger-btn"
              onClick={onConnectLedgerUsb}
              disabled={!isLedgerSupported || isConnecting || isLedgerConnecting}
              title={!isLedgerSupported ? "Ledger USB requires Chrome/Edge/Brave (WebHID)" : ""}
            >
              <span className="sim-ledger-btn-text">
                {isLedgerConnecting ? "Connecting Ledger..." : "Connect Ledger (USB)"}
              </span>
              <span className="sim-ledger-badge">Chromium</span>
            </button>

            <div className="sim-ledger-hint">
              Plug in your Ledger, unlock it, and open the <b>Ethereum</b> app.
              <br />
              (Chrome / Edge / Brave only)
            </div>

            {errorMessage && <div className="sim-error">{errorMessage}</div>}
          </div>

          {/* Divider */}
          <div className="sim-divider">
            <span>or</span>
          </div>

          {/* Social + Email + Wallets */}
          <div className="sim-embed-wrapper">
            <ConnectEmbed
              client={thirdwebClient}
              chain={ETHERLINK_CHAIN}
              autoConnect={false}
              theme="light"
              modalSize="compact"
              showThirdwebBranding={false}
              wallets={[
                inAppWallet({
                  auth: {
                    options: [
                      "email",
                      "google",
                      "apple",
                      "facebook",
                      "discord",
                      "phone",
                      "passkey",
                      // NOTE: "x" only works if enabled/configured in thirdweb dashboard for your client.
                      // If not enabled, remove it to avoid runtime issues.
                      "x",
                    ],
                  },
                  metadata: { name: "Ppopgi" },
                }),
                createWallet("io.metamask"),
                createWallet("walletConnect"),
                createWallet("com.coinbase.wallet"),
              ]}
            />
          </div>

          <div className="sim-footer">
            <div className="sim-note">
              By connecting, you agree to the rules of the lottery.
              <br />
              Always check the URL before signing.
            </div>

            {wallet && (
              <button className="sim-disconnect-btn" onClick={() => disconnect(wallet)}>
                Disconnect current session
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignInModal;