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
import { createWallet } from "thirdweb/wallets";
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
  const { connect, isConnecting } = useConnect();

  const { connectLedgerUsb, isSupported, isConnecting: isLedgerConnecting, error: ledgerError } =
    useLedgerUsbWallet();

  const [localError, setLocalError] = useState<string>("");

  const combinedError = useMemo(() => {
    return localError || ledgerError || "";
  }, [localError, ledgerError]);

  // Sync Session & Auto-Close on Connect
  useEffect(() => {
    if (!open) return;
    if (!account?.address) return;

    setSession({
      account: account.address,
      connector: "thirdweb",
    });

    const t = setTimeout(() => {
      onClose();
    }, 500);
    return () => clearTimeout(t);
  }, [account?.address, open, onClose, setSession]);

  // Clear transient error when reopening
  useEffect(() => {
    if (open) setLocalError("");
  }, [open]);

  const onConnectLedgerUsb = async () => {
    setLocalError("");
    try {
      // connectLedgerUsb() should do the WebHID flow + return an EIP-1193 provider (or a thirdweb wallet)
      // We wrap it into thirdweb connection via useConnect so the rest of your app works normally.
      await connect(async () => {
        const ledgerWallet = await connectLedgerUsb({
          client: thirdwebClient,
          chain: ETHERLINK_CHAIN,
        });
        return ledgerWallet;
      });
    } catch (e: any) {
      setLocalError(e?.message ? String(e.message) : "Failed to connect Ledger via USB.");
    }
  };

  if (!open) return null;

  return (
    <div className="sim-overlay" onMouseDown={onClose}>
      <div className="sim-card" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sim-header">
          <div>
            <h2 className="sim-title">Welcome to Ppopgi</h2>
            <div className="sim-subtitle">Connect your wallet to start playing</div>
          </div>
          <button className="sim-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="sim-body">
          {/* Ledger USB (WebHID) - Separate from thirdweb wallet list */}
          <div className="sim-ledger-section">
            <button
              className="sim-ledger-btn"
              onClick={onConnectLedgerUsb}
              disabled={!isSupported || isConnecting || isLedgerConnecting}
              title={!isSupported ? "Ledger USB requires Chromium (Chrome/Brave/Edge) + WebHID enabled." : ""}
            >
              {isLedgerConnecting ? "Connecting Ledger..." : "Connect Ledger (USB)"}
              <span className="sim-ledger-badge">Chromium</span>
            </button>

            {!isSupported && (
              <div className="sim-ledger-hint">
                Ledger USB needs a Chromium browser (Chrome/Brave/Edge). On Ledger, open the Ethereum app.
              </div>
            )}

            {combinedError && <div className="sim-error">{combinedError}</div>}
          </div>

          <div className="sim-divider">
            <span>or</span>
          </div>

          {/* Thirdweb Embed - only registered wallet IDs here */}
          <div className="sim-embed-wrapper">
            <ConnectEmbed
              client={thirdwebClient}
              chain={ETHERLINK_CHAIN}
              autoConnect={false}
              theme="light"
              modalSize="compact"
              showThirdwebBranding={false}
              wallets={[
                createWallet("io.metamask"),
                createWallet("walletConnect"),
                createWallet("com.coinbase.wallet"),
                // Optional: if you ALSO want Ledger Live (not USB WebHID), you can add:
                // createWallet("com.ledger"),
              ]}
            />
          </div>

          <div className="sim-footer">
            <div className="sim-note">
              By connecting, you agree to the rules of the raffle.
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