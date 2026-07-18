interface SealTimelineProps {
  state: number;
  shippedAt: bigint;
}

const HAPPY_STEPS = [
  { label: "Created", glyph: "\u2712" },
  { label: "Payment Locked", glyph: "\u25c8" },
  { label: "Shipped", glyph: "\u2726" },
  { label: "Completed", glyph: "\u2713" },
];

function getProgress(state: number, shippedAt: bigint) {
  switch (state) {
    case 0: // Created
      return { reached: 0, exception: null };
    case 1: // Cancelled
      return { reached: 0, exception: { label: "Cancelled", tone: "ember" as const } };
    case 2: // Locked
      return { reached: 1, exception: null };
    case 3: // Shipped
      return { reached: 2, exception: null };
    case 4: // Disputed
      return {
        reached: shippedAt > 0n ? 2 : 1,
        exception: { label: "Dispute Opened", tone: "ember" as const },
      };
    case 5: // Completed
      return { reached: 3, exception: null };
    case 6: // Refunded
      return { reached: 1, exception: { label: "Refunded", tone: "ember" as const } };
    case 7: // Resolved
      return {
        reached: shippedAt > 0n ? 2 : 1,
        exception: { label: "Arbiter Resolved", tone: "moss" as const },
      };
    default:
      return { reached: 0, exception: null };
  }
}

function Seal({ active, glyph, tone = "seal" }: { active: boolean; glyph: string; tone?: "seal" | "ember" | "moss" }) {
  const toneClasses = {
    seal: active
      ? "border-seal-bright bg-seal/25 text-seal-bright shadow-[0_0_0_3px_rgba(184,134,59,0.15)]"
      : "border-slate/30 text-slate/50",
    ember: "border-ember-bright bg-ember/20 text-ember-bright shadow-[0_0_0_3px_rgba(154,51,36,0.15)]",
    moss: "border-moss-bright bg-moss/20 text-moss-bright shadow-[0_0_0_3px_rgba(75,107,79,0.15)]",
  }[tone];

  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 font-display text-lg transition-all ${toneClasses}`}
    >
      {glyph}
    </div>
  );
}

export function SealTimeline({ state, shippedAt }: SealTimelineProps) {
  const { reached, exception } = getProgress(state, shippedAt);

  return (
    <div className="flex items-start gap-0">
      {HAPPY_STEPS.map((step, i) => {
        const active = i <= reached && !(exception && i > reached);
        const isLast = i === HAPPY_STEPS.length - 1;
        const dimmed = exception ? i > reached : false;

        return (
          <div key={step.label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {i !== 0 && (
                <div
                  className={`h-px flex-1 border-t ${
                    i <= reached ? "border-seal/60" : "border-slate/25"
                  } border-dashed`}
                />
              )}
              <Seal active={active} glyph={step.glyph} />
              {!isLast && (
                <div
                  className={`h-px flex-1 border-t ${
                    i < reached ? "border-seal/60" : "border-slate/25"
                  } border-dashed`}
                />
              )}
            </div>
            <span
              className={`mt-2 text-center font-sans text-[11px] uppercase tracking-label ${
                dimmed ? "text-slate/40" : active ? "text-paper/90" : "text-slate/50"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}

      {exception && (
        <div className="flex flex-col items-center pl-3">
          <Seal active glyph={exception.tone === "moss" ? "\u2696" : "!"} tone={exception.tone} />
          <span
            className={`mt-2 text-center font-sans text-[11px] uppercase tracking-label ${
              exception.tone === "moss" ? "text-moss-bright" : "text-ember-bright"
            }`}
          >
            {exception.label}
          </span>
        </div>
      )}
    </div>
  );
}
