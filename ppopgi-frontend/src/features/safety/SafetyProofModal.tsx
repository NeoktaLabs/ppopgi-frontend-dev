import { Modal } from "../../ui/Modal";
import { addrUrl } from "../../lib/explorer";

export function SafetyProofModal({
  open,
  onClose,
  raffleId,
  creator,
}: {
  open: boolean;
  onClose: () => void;
  raffleId: string;
  creator?: string | null;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Safety & Proof">
      <div style={{ display: "grid", gap: 12, lineHeight: 1.6 }}>
        <div>
          <div style={{ fontWeight: 1000 }}>What the app cannot do</div>
          <ul style={{ marginTop: 8 }}>
            <li>It cannot choose the winner.</li>
            <li>It cannot change the rules after creation.</li>
            <li>It cannot take prizes or refunds once they’re owed.</li>
          </ul>
        </div>

        <div>
          <div style={{ fontWeight: 1000 }}>Proof links</div>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            <a href={addrUrl(raffleId)} target="_blank" rel="noreferrer">
              View raffle proof
            </a>
            {creator && (
              <a href={addrUrl(creator)} target="_blank" rel="noreferrer">
                View creator proof
              </a>
            )}
          </div>
        </div>

        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Next: we’ll add the “Who gets what” fee breakdown from live on-chain reads.
        </div>
      </div>
    </Modal>
  );
}