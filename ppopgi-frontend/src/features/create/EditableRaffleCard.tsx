// src/features/create/EditableRaffleCard.tsx
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { Ticket, Clock, Hash, Coins, Settings2, ChevronDown, ChevronUp } from "lucide-react";

type Draft = {
  name: string;
  ticketPrice: string; // USDC input (decimal string)
  winningPot: string; // USDC input (decimal string)

  // UX: duration as human text (supports "90m", "1h30", "2d", "5400s")
  durationText: string;

  minTickets: string; // integer string
  maxTickets: string; // optional integer string ("" => unlimited, "0" => unlimited)
  minPurchaseAmount: string; // optional integer string
};

export type EditableRaffleCardValue = Draft;

export function EditableRaffleCard({
  value,
  onChange,
  feePercent,
  errors,
  showAdvanced = true,
  creatorLabel,
}: {
  value: Draft;
  onChange: (patch: Partial<Draft>) => void;
  feePercent: number | null;
  errors?: Partial<Record<keyof Draft, string>>;
  showAdvanced?: boolean;
  creatorLabel?: string; // ex: "0xabc…1234"
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const requiredFields: Array<{ key: keyof Draft; label: string }> = [
    { key: "name", label: "Name" },
    { key: "ticketPrice", label: "Ticket price" },
    { key: "winningPot", label: "Winning pot" },
    { key: "durationText", label: "Duration" },
    { key: "minTickets", label: "Min tickets" },
  ];

  const hasError = (k: keyof Draft) => !!errors?.[k];

  const durationHelp = useMemo(() => {
    return `Examples: 90m, 1h30, 2d, 5400s`;
  }, []);

  return (
    <div style={cardInner()}>
      {/* Top row: status-ish + creator */}
      <div style={topRow()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={badge("info")}>
            <Ticket size={14} />
            Draft
          </div>

          <div style={pillSoft()}>
            <span style={{ opacity: 0.75 }}>Required</span>{" "}
            <span style={{ fontWeight: 1000 }}>
              {requiredFields.filter((f) => !String(value[f.key] ?? "").trim()).length === 0 ? "✓" : "…"}
            </span>
          </div>
        </div>

        {creatorLabel ? (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 900, fontSize: 11, opacity: 0.65 }}>Creator</div>
            <div style={{ fontWeight: 1000, fontSize: 12, opacity: 0.9 }}>{creatorLabel}</div>
          </div>
        ) : null}
      </div>

      {/* Title area */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 1000, fontSize: 11, opacity: 0.65, letterSpacing: 0.6 }}>
          CREATE
        </div>

        <div style={{ marginTop: 4 }}>
          <label style={labelRow()}>
            <span style={{ fontWeight: 1000, fontSize: 18, lineHeight: 1.1 }}>New raffle</span>
            <Req />
          </label>

          <input
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="My raffle"
            style={input(hasError("name"))}
          />
          {errors?.name ? <div style={errText()}>{errors.name}</div> : null}
        </div>
      </div>

      {/* Main “pills” area like real card, but editable */}
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <div style={grid2()}>
          <Field
            icon={<Coins size={16} />}
            label="Winning pot (USDC)"
            required
            error={errors?.winningPot}
          >
            <input
              value={value.winningPot}
              onChange={(e) => onChange({ winningPot: e.target.value })}
              inputMode="decimal"
              style={input(hasError("winningPot"))}
              placeholder="10"
            />
          </Field>

          <Field
            icon={<Coins size={16} />}
            label="Ticket price (USDC)"
            required
            error={errors?.ticketPrice}
          >
            <input
              value={value.ticketPrice}
              onChange={(e) => onChange({ ticketPrice: e.target.value })}
              inputMode="decimal"
              style={input(hasError("ticketPrice"))}
              placeholder="1"
            />
          </Field>
        </div>

        <div style={grid2()}>
          <Field icon={<Clock size={16} />} label="Duration" required error={errors?.durationText}>
            <input
              value={value.durationText}
              onChange={(e) => onChange({ durationText: e.target.value })}
              style={input(hasError("durationText"))}
              placeholder="e.g. 1h30"
            />
            <div style={helpText()}>{durationHelp}</div>

            {/* Quick chips */}
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Chip onClick={() => onChange({ durationText: "30m" })}>30m</Chip>
              <Chip onClick={() => onChange({ durationText: "1h" })}>1h</Chip>
              <Chip onClick={() => onChange({ durationText: "1h30" })}>1h30</Chip>
              <Chip onClick={() => onChange({ durationText: "1d" })}>1d</Chip>
            </div>
          </Field>

          <div style={{ display: "grid", gap: 10 }}>
            <Field icon={<Hash size={16} />} label="Min tickets" required error={errors?.minTickets}>
              <input
                value={value.minTickets}
                onChange={(e) => onChange({ minTickets: e.target.value })}
                inputMode="numeric"
                style={input(hasError("minTickets"))}
                placeholder="1"
              />
            </Field>

            {/* Progress-ish row like real card bottom */}
            <div style={metaRow()}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Preview</div>
              <div style={ctaPill()}>
                {feePercent !== null ? `${feePercent}% fee` : "Fee…"}
              </div>
            </div>
          </div>
        </div>

        {/* Advanced */}
        {showAdvanced ? (
          <div style={{ marginTop: 2 }}>
            <button
              type="button"
              onClick={() => setAdvancedOpen((s) => !s)}
              style={advancedBtn()}
              aria-expanded={advancedOpen}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Settings2 size={16} />
                Advanced settings
              </div>
              {advancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {advancedOpen ? (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <div style={grid2()}>
                  <Field icon={<Hash size={16} />} label="Max tickets (optional)" hint="Leave empty for unlimited">
                    <input
                      value={value.maxTickets}
                      onChange={(e) => onChange({ maxTickets: e.target.value })}
                      inputMode="numeric"
                      style={input(false)}
                      placeholder="Unlimited"
                    />
                  </Field>

                  <Field icon={<Hash size={16} />} label="Minimum buy (optional)" hint="Defaults to 1">
                    <input
                      value={value.minPurchaseAmount}
                      onChange={(e) => onChange({ minPurchaseAmount: e.target.value })}
                      inputMode="numeric"
                      style={input(false)}
                      placeholder="1"
                    />
                  </Field>
                </div>

                <div style={helpBox()}>
                  Advanced fields are optional. If you don’t set them, the raffle behaves like a simple, open-ended raffle.
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Bottom */}
      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>You can edit everything directly in this card.</div>
        <div style={pillSoft()}>
          <span style={{ opacity: 0.75 }}>Tip</span>{" "}
          <span style={{ fontWeight: 1000 }}>Use 1h30 format</span>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  required,
  hint,
  error,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={fieldWrap()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <div style={iconPill()}>{icon}</div>
          <div>
            <div style={{ fontWeight: 1000, fontSize: 12, opacity: 0.9 }}>
              {label} {required ? <Req /> : null}
            </div>
            {hint ? <div style={{ fontSize: 11, opacity: 0.65, fontWeight: 800 }}>{hint}</div> : null}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>{children}</div>
      {error ? <div style={errText()}>{error}</div> : null}
    </div>
  );
}

function Req() {
  return (
    <span
      style={{
        marginLeft: 8,
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 1000,
        border: "1px solid rgba(255,255,255,0.45)",
        background: "rgba(255, 216, 154, 0.28)",
      }}
      title="Required"
    >
      Required
    </span>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={chip()}>
      {children}
    </button>
  );
}

/* Styles (kept close to your RaffleCard) */

function cardInner(): CSSProperties {
  return {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.18)",
    backdropFilter: "blur(14px)",
    boxShadow: "0 10px 34px rgba(0,0,0,0.08)",
    padding: 14,
  };
}

function topRow(): CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  };
}

function labelRow(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  };
}

function grid2(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  };
}

function fieldWrap(): CSSProperties {
  return {
    padding: 12,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.40)",
    background: "rgba(255,255,255,0.16)",
  };
}

function iconPill(): CSSProperties {
  return {
    height: 30,
    width: 30,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.40)",
    background: "rgba(255,255,255,0.18)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function input(isBad: boolean): CSSProperties {
  return {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: isBad ? "1px solid rgba(255,120,120,0.75)" : "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.22)",
    outline: "none",
    fontWeight: 1000,
    fontSize: 14,
  };
}

function helpText(): CSSProperties {
  return { marginTop: 6, fontSize: 11, fontWeight: 800, opacity: 0.7 };
}

function errText(): CSSProperties {
  return { marginTop: 8, fontSize: 11, fontWeight: 900, color: "rgba(180,20,20,0.95)" };
}

function helpBox(): CSSProperties {
  return {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.14)",
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.85,
  };
}

function metaRow(): CSSProperties {
  return {
    padding: 12,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.40)",
    background: "rgba(255,255,255,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };
}

function badge(kind: "ok" | "warn" | "info" | "muted"): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 1000,
    fontSize: 12,
    border: "1px dashed rgba(255,255,255,0.55)",
  };

  if (kind === "ok") return { ...base, background: "rgba(140, 255, 200, 0.18)" };
  if (kind === "warn") return { ...base, background: "rgba(255, 210, 120, 0.20)" };
  if (kind === "info") return { ...base, background: "rgba(169, 212, 255, 0.18)" };
  return { ...base, background: "rgba(255,255,255,0.14)" };
}

function pillSoft(): CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.40)",
    background: "rgba(255,255,255,0.20)",
    fontSize: 12,
  };
}

function ctaPill(): CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.50)",
    background: "rgba(255,255,255,0.22)",
    fontWeight: 1000,
    fontSize: 12,
  };
}

function advancedBtn(): CSSProperties {
  return {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "12px 12px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.40)",
    background: "rgba(255,255,255,0.16)",
    fontWeight: 1000,
    cursor: "pointer",
  };
}

function chip(): CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.20)",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
  };
}