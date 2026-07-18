"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { arcTestnet } from "@/lib/chains";
import { truncateAddress } from "@/lib/format";

export function ConnectButton() {
  // Wagmi auto-reconnects a previously authorized wallet right after mount,
  // which differs from the server-rendered "disconnected" markup and causes
  // a hydration mismatch. We wait for the client to mount before showing any
  // wallet-dependent state.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  if (!mounted) {
    return (
      <button
        disabled
        className="rounded-sm border border-slate/30 bg-ink-soft px-4 py-2 font-sans text-sm font-medium tracking-wideish text-paper/40"
      >
        Connect Wallet
      </button>
    );
  }

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        disabled={isPending}
        className="rounded-sm border border-seal/60 bg-seal/10 px-4 py-2 font-sans text-sm font-medium tracking-wideish text-seal-bright transition hover:bg-seal/20 disabled:opacity-50"
      >
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  if (chainId !== arcTestnet.id) {
    return (
      <button
        onClick={() => switchChain({ chainId: arcTestnet.id })}
        disabled={isSwitching}
        className="rounded-sm border border-ember/60 bg-ember/10 px-4 py-2 font-sans text-sm font-medium tracking-wideish text-ember-bright transition hover:bg-ember/20 disabled:opacity-50"
      >
        {isSwitching ? "Switching..." : "Switch to Arc Testnet"}
      </button>
    );
  }

  return (
    <button
      onClick={() => disconnect()}
      className="group flex items-center gap-2 rounded-sm border border-slate/30 bg-ink-soft px-4 py-2 font-mono text-sm text-paper/90 transition hover:border-ember/50"
      title="Disconnect"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-moss-bright" />
      {truncateAddress(address)}
      <span className="hidden text-slate group-hover:inline">x</span>
    </button>
  );
}
