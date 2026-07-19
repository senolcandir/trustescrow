export const STATE_LABELS = [
  "Created",
  "Cancelled",
  "Payment Locked",
  "Shipped",
  "Disputed",
  "Completed",
  "Refunded",
  "Resolved",
] as const;

export type EscrowState = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function stateLabel(state: number): string {
  return STATE_LABELS[state] ?? "Unknown";
}

export function truncateAddress(address?: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

export function isZeroAddress(address?: string): boolean {
  return !address || /^0x0+$/.test(address);
}

// Guards against rendering a broken/relative link as a clickable <a> tag.
// If evidence was saved without "https://" (e.g. "drive.google.com/..."),
// browsers treat it as a path on our own site, which 404s and can trigger a
// client-side navigation exception in Next.js. We only render a real link
// when it parses as an absolute http(s) URL; otherwise we show it as plain
// text instead of crashing.
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const DAY = 24n * 60n * 60n;

export function secondsUntil(target: bigint, now: bigint): bigint {
  return target > now ? target - now : 0n;
}

export function formatDuration(totalSeconds: bigint): string {
  if (totalSeconds <= 0n) return "time's up";
  const days = totalSeconds / DAY;
  const hours = (totalSeconds % DAY) / 3600n;
  if (days > 0n) return `${days}d ${hours}h`;
  const minutes = (totalSeconds % 3600n) / 60n;
  if (hours > 0n) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
