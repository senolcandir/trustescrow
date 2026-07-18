"use client";

import { useState } from "react";
import { truncateAddress } from "@/lib/format";

export function AddressChip({ address, label }: { address: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available, ignore silently
    }
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy address"
      className="group inline-flex items-center gap-1.5 font-mono text-sm text-paper/85 transition hover:text-seal-bright"
    >
      {label && <span className="text-slate">{label}</span>}
      <span className="tabular">{truncateAddress(address, 5)}</span>
      <span className="text-xs text-slate group-hover:text-seal-bright">
        {copied ? "✓" : "⧉"}
      </span>
    </button>
  );
}
