import { Modal } from "../../ui/Modal";
import { storage } from "../../lib/storage";

const KEY = "ppopgi_disclaimer_ok_v1";

export function DisclaimerGate({ onAccept }: { onAccept: () => void }) {
  const accepted = storage.getBool(KEY);

  return (
    <Modal
      open={!accepted}
      onClose={() => {
        // no “close to skip”
      }}
      title="Before you play"
      fullscreen
    >
      <div style={{ maxWidth: 720, margin: "0 auto", paddingTop: 32 }}>
        <ul style={{ fontSize: 18, lineHeight: 1.6 }}>
          <li style={{ marginBottom: 10 }}>This is an experimental app.</li>
          <li style={{ marginBottom: 10 }}>You’re responsible for your choices.</li>
          <li style={{ marginBottom: 10 }}>
            Only play with money you can afford to lose.
          </li>
        </ul>

        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => {
              storage.setBool(KEY, true);
              onAccept();
            }}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.45)",
              background: "rgba(255,255,255,0.30)",
              cursor: "pointer",
              fontWeight: 1000,
              fontSize: 16,
            }}
          >
            I understand — let’s go
          </button>
        </div>
      </div>
    </Modal>
  );
}