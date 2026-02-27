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

const shortAddr = (a: string) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "—");

// common base paths
const LEDGER_PATH_PRESETS = [
  { id: "ledgerlive", label: "Ledger Live", base: "44'/60'/0'/0" },
  { id: "legacy", label: "Legacy", base: "44'/60'/0'" },
  { id: "bip44", label: "BIP44 (Metamask-style)", base: "44'/60'/0'/0" },
];

export function SignInModal({ open, onClose }: Props) {
  const setSession = useSession((s) => s.set);
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();

  const { connect, isConnecting, error: connectError } = useConnect({ client: thirdwebClient });

  const {
    connectLedgerUsb,
    isSupported: isLedgerSupported,
    isConnecting: isLedgerConnecting,
    error: ledgerError,
    scanAccounts,
    setSelectedPath,
  } = useLedgerUsbWallet();

  const [localError, setLocalError] = useState("");

  // ✅ NEW: picker modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pathPreset, setPathPreset] = useState(LEDGER_PATH_PRESETS[0]);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanRows, setScanRows] = useState<{ path: string; address: string }[]>([]);
  const [selectedRow, setSelectedRow] = useState<{ path: string; address: string } | null>(null);

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
    if (open) {
      setLocalError("");
      // reset picker on open
      setPickerOpen(false);
      setScanRows([]);
      setSelectedRow(null);
      setScanBusy(false);
      setPathPreset(LEDGER_PATH_PRESETS[0]);
    }
  }, [open]);

  const openLedgerPicker = async () => {
    setLocalError("");
    if (!isLedgerSupported) {
      setLocalError("Ledger USB requires Chrome/Edge/Brave (WebHID).");
      return;
    }
    setPickerOpen(true);
  };

  const doScan = async () => {
    setLocalError("");
    setScanBusy(true);
    setSelectedRow(null);
    try {
      const rows = await scanAccounts({ basePath: pathPreset.base, startIndex: 0, count: 5 });
      setScanRows(rows);
    } catch (e: any) {
      setLocalError(e?.message ? String(e.message) : "Failed to scan Ledger accounts.");
    } finally {
      setScanBusy(false);
    }
  };

  const confirmLedgerSelection = async () => {
    if (!selectedRow) return;

    setLocalError("");
    try {
      // ✅ set the selected session (path + address) BEFORE connecting thirdweb wallet
      await setSelectedPath(selectedRow.path);

      await connect(async () => {
        const w = await connectLedgerUsb({
          client: thirdwebClient,
          chain: ETHERLINK_CHAIN,
          preferredPath: selectedRow.path,
        });
        return w;
      });

      setPickerOpen(false);
    } catch (e: any) {
      setLocalError(e?.message ? String(e.message) : "Failed to connect Ledger.");
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
          {/* Ledger USB section */}
          <div className="sim-ledger-section">
            <button
              className="sim-ledger-btn"
              onClick={openLedgerPicker}
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
              (Works on Chrome / Edge / Brave via WebHID)
            </div>

            {errorMessage && <div className="sim-error">{errorMessage}</div>}
          </div>

          {/* ✅ NEW: Ledger Picker Modal */}
          {pickerOpen && (
            <div className="sim-overlay" style={{ zIndex: 9999 }} onMouseDown={() => setPickerOpen(false)}>
              <div className="sim-card" onMouseDown={(e) => e.stopPropagation()}>
                <div className="sim-header">
                  <div>
                    <h2 className="sim-title">Select Ledger account</h2>
                    <div className="sim-subtitle">Choose a derivation path and pick an address</div>
                  </div>
                  <button className="sim-close-btn" onClick={() => setPickerOpen(false)}>
                    ✕
                  </button>
                </div>

                <div className="sim-body">
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                    <label style={{ fontWeight: 700, fontSize: 13, opacity: 0.85 }}>Path</label>
                    <select
                      value={pathPreset.id}
                      onChange={(e) => {
                        const next = LEDGER_PATH_PRESETS.find((p) => p.id === e.target.value) || LEDGER_PATH_PRESETS[0];
                        setPathPreset(next);
                        setScanRows([]);
                        setSelectedRow(null);
                      }}
                      style={{ flex: 1, padding: 10, borderRadius: 10 }}
                    >
                      {LEDGER_PATH_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} ({p.base}/0)
                        </option>
                      ))}
                    </select>

                    <button
                      className="sim-ledger-btn"
                      style={{ width: 150 }}
                      onClick={doScan}
                      disabled={scanBusy}
                    >
                      {scanBusy ? "Scanning..." : "Scan"}
                    </button>
                  </div>

                  {scanRows.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                      {scanRows.map((row) => {
                        const picked = selectedRow?.path === row.path;
                        return (
                          <button
                            key={row.path}
                            onClick={() => setSelectedRow(row)}
                            style={{
                              textAlign: "left",
                              padding: 12,
                              borderRadius: 12,
                              border: picked ? "2px solid #db2777" : "1px solid rgba(0,0,0,0.12)",
                              background: picked ? "rgba(219,39,119,0.06)" : "#fff",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontWeight: 900 }}>{shortAddr(row.address)}</div>
                            <div style={{ fontSize: 12, opacity: 0.75 }}>{row.path}</div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 12 }}>
                      Click <b>Scan</b> to fetch the first few Ledger addresses for this path.
                    </div>
                  )}

                  <button
                    className="sim-ledger-btn"
                    onClick={confirmLedgerSelection}
                    disabled={!selectedRow || isConnecting || isLedgerConnecting}
                    style={{ width: "100%" }}
                  >
                    Use selected address
                  </button>

                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                    Make sure the <b>Ethereum app</b> is open on your Ledger.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="sim-divider">
            <span>or</span>
          </div>

          {/* Thirdweb embed */}
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
              ]}
            />
          </div>

          {/* Footer */}
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