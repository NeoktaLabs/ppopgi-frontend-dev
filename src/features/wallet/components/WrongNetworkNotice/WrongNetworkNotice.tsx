// src/components/WrongNetworkNotice.tsx
import { ETHERLINK_MAINNET } from "../../../../shared/lib/thirdweb/etherlink-chain";

export function WrongNetworkNotice() {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 14,
        background: "rgba(255,255,255,0.18)",
        border: "1px solid rgba(255,255,255,0.35)",
        fontSize: 14,
        color: "#2B2B33",
        lineHeight: 1.4,
      }}
    >
      <div style={{ fontWeight: 600 }}>You’re in the wrong place</div>
      <div style={{ marginTop: 6 }}>
        This raffle runs on <b>{ETHERLINK_MAINNET.chainName}</b>.
      </div>
      <div style={{ marginTop: 6 }}>
        Switch where you play, then try again.
      </div>
    </div>
  );
}