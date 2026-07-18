"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { formatUnits } from "viem";
import { ARC_ESCROW_ABI } from "@/lib/abi";
import { ARC_ESCROW_ADDRESS } from "@/lib/contract";
import { arcTestnet, ARC_USDC_DECIMALS } from "@/lib/chains";
import { stateLabel, truncateAddress } from "@/lib/format";
import { ConnectButton } from "@/components/ConnectButton";

type Row = {
  id: bigint;
  seller: `0x${string}`;
  buyer: `0x${string}`;
  amount: bigint;
  state: number;
};

export default function MyEscrowsPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onArc = chainId === arcTestnet.id;
  const publicClient = usePublicClient({ chainId: arcTestnet.id });

  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!address || !publicClient || !onArc) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        // Arc's block time is sub-second, so scanning event logs by block
        // range grows huge very fast and can hang. Instead we read the
        // contract's own incrementing counter and fetch each escrow by id
        // directly - this scales with the number of escrows, not blocks.
        const nextId = (await publicClient!.readContract({
          address: ARC_ESCROW_ADDRESS,
          abi: ARC_ESCROW_ABI,
          functionName: "nextEscrowId",
        })) as bigint;

        const totalEscrows = Number(nextId) - 1;

        if (totalEscrows <= 0) {
          if (!cancelled) setRows([]);
          return;
        }

        const ids = Array.from({ length: totalEscrows }, (_, i) => BigInt(i + 1));

        // Sequential reads with a gap, instead of firing everything at once -
        // Arc's public testnet RPC rate-limits bursty parallel calls hard
        // during busy periods.
        const details: Row[] = [];
        for (const id of ids) {
          if (cancelled) return;
          const data = (await publicClient!.readContract({
            address: ARC_ESCROW_ADDRESS,
            abi: ARC_ESCROW_ABI,
            functionName: "getEscrow",
            args: [id],
          })) as { seller: `0x${string}`; buyer: `0x${string}`; amount: bigint; state: number };
          details.push({ id, seller: data.seller, buyer: data.buyer, amount: data.amount, state: data.state });
          await new Promise((resolve) => setTimeout(resolve, 400));
        }

        const mine = details.filter(
          (d) =>
            d.seller.toLowerCase() === address!.toLowerCase() ||
            d.buyer.toLowerCase() === address!.toLowerCase()
        );

        if (!cancelled) {
          mine.sort((a, b) => (a.id > b.id ? -1 : 1));
          setRows(mine);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to read escrows from chain."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [address, publicClient, onArc, reloadKey]);

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-md rounded-sm border border-ink-line bg-ink-soft p-8 text-center">
        <p className="font-display text-xl text-paper">Connect your wallet first</p>
        <div className="mt-6 flex justify-center">
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (!onArc) {
    return (
      <div className="mx-auto max-w-md rounded-sm border border-ember/40 bg-ember/10 p-8 text-center">
        <p className="font-display text-xl text-paper">Wrong network</p>
        <div className="mt-6 flex justify-center">
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-label text-seal-bright">
        Connected wallet: {truncateAddress(address)}
      </p>
      <h1 className="mt-2 font-display text-3xl text-paper">My Escrows</h1>

      {loading && <p className="mt-8 font-sans text-sm text-slate">Reading from chain...</p>}

      {!loading && loadError && (
        <div className="mt-8 rounded-sm bg-ember/10 px-4 py-4 font-sans text-sm text-ember-bright">
          <p>
            Arc&apos;s public testnet RPC is busy right now and rate-limited this
            request. This isn&apos;t a bug in the app - just try again.
          </p>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="mt-3 rounded-sm border border-ember-bright/50 px-4 py-2 font-sans text-sm font-semibold text-ember-bright transition hover:bg-ember/20"
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !loadError && rows && rows.length === 0 && (
        <div className="mt-8 rounded-sm border border-ink-line bg-ink-soft p-8 text-center">
          <p className="font-sans text-sm text-paper/60">
            No escrow was found for this wallet.
          </p>
          <Link
            href="/create"
            className="mt-4 inline-block rounded-sm bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-ink hover:bg-seal-bright"
          >
            Create Escrow
          </Link>
        </div>
      )}

      {!loading && !loadError && rows && rows.length > 0 && (
        <div className="mt-8 divide-y divide-ink-line rounded-sm border border-ink-line bg-ink-soft">
          {rows.map((row) => (
            <Link
              key={row.id.toString()}
              href={`/escrow/${row.id.toString()}`}
              className="flex items-center justify-between px-5 py-4 transition hover:bg-ink"
            >
              <div>
                <span className="font-mono text-xs text-slate">
                  #{row.id.toString()} ·{" "}
                  {row.seller.toLowerCase() === address?.toLowerCase() ? "Seller" : "Buyer"}
                </span>
                <p className="font-display text-xl text-paper">
                  {formatUnits(row.amount, ARC_USDC_DECIMALS)} USDC
                </p>
              </div>
              <span className="font-sans text-xs font-medium uppercase tracking-label text-seal-bright">
                {stateLabel(row.state)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
