"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useChainId,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { decodeEventLog, isAddress, parseUnits } from "viem";
import { ARC_ESCROW_ABI } from "@/lib/abi";
import { ARC_ESCROW_ADDRESS } from "@/lib/contract";
import { arcTestnet, ARC_USDC_DECIMALS } from "@/lib/chains";
import { ConnectButton } from "@/components/ConnectButton";

export default function CreateEscrowPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onArc = chainId === arcTestnet.id;

  const [buyer, setBuyer] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const newEscrowId = useMemo(() => {
    if (!receipt) return null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== ARC_ESCROW_ADDRESS.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: ARC_ESCROW_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "EscrowCreated") {
          return (decoded.args as { id: bigint }).id;
        }
      } catch {
        // not our event, skip
      }
    }
    return null;
  }, [receipt]);

  useEffect(() => {
    if (newEscrowId !== null) {
      router.push(`/escrow/${newEscrowId.toString()}`);
    }
  }, [newEscrowId, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!isAddress(buyer)) {
      setFormError("Enter a valid buyer wallet address (starts with 0x, 42 characters).");
      return;
    }
    if (address && buyer.toLowerCase() === address.toLowerCase()) {
      setFormError("The buyer address can't be your own wallet.");
      return;
    }
    const amountNumber = Number(amount);
    if (!amount || isNaN(amountNumber) || amountNumber <= 0) {
      setFormError("Enter a valid amount (greater than 0).");
      return;
    }

    const amountUnits = parseUnits(amount, ARC_USDC_DECIMALS);

    writeContract({
      address: ARC_ESCROW_ADDRESS,
      abi: ARC_ESCROW_ABI,
      functionName: "createEscrow",
      args: [buyer as `0x${string}`, amountUnits],
    });
  }

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-md rounded-sm border border-ink-line bg-ink-soft p-8 text-center">
        <p className="font-display text-xl text-paper">Connect your wallet first</p>
        <p className="mt-2 font-sans text-sm text-paper/60">
          You need to connect the seller&apos;s wallet to create an escrow.
        </p>
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
        <p className="mt-2 font-sans text-sm text-paper/60">
          You need to switch to Arc Testnet to continue.
        </p>
        <div className="mt-6 flex justify-center">
          <ConnectButton />
        </div>
      </div>
    );
  }

  const isBusy = isPending || isConfirming;

  return (
    <div className="mx-auto max-w-lg">
      <p className="font-mono text-xs uppercase tracking-label text-seal-bright">Seller</p>
      <h1 className="mt-2 font-display text-3xl text-paper">Create a New Escrow</h1>
      <p className="mt-3 font-sans text-sm leading-relaxed text-paper/65">
        Enter the buyer&apos;s wallet address and the amount you agreed on. Once
        the escrow is created, we&apos;ll give you a link — send that link to the
        buyer over DM.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-sm border border-ink-line bg-ink-soft p-6">
        <div>
          <label className="block font-sans text-xs font-medium uppercase tracking-label text-slate">
            Buyer Wallet Address
          </label>
          <input
            type="text"
            value={buyer}
            onChange={(e) => setBuyer(e.target.value)}
            placeholder="0x..."
            className="mt-2 w-full rounded-sm border border-ink-line bg-ink px-4 py-3 font-mono text-sm text-paper placeholder:text-slate/50 focus:border-seal/60"
          />
        </div>

        <div>
          <label className="block font-sans text-xs font-medium uppercase tracking-label text-slate">
            Amount (USDC)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5"
            className="mt-2 w-full rounded-sm border border-ink-line bg-ink px-4 py-3 font-mono text-lg tabular text-paper placeholder:text-slate/50 focus:border-seal/60"
          />
        </div>

        {formError && (
          <p className="rounded-sm bg-ember/10 px-3 py-2 font-sans text-sm text-ember-bright">
            {formError}
          </p>
        )}
        {writeError && (
          <p className="rounded-sm bg-ember/10 px-3 py-2 font-sans text-sm text-ember-bright">
            The transaction was rejected or failed. Make sure your wallet has
            enough native USDC (gas).
          </p>
        )}

        <button
          type="submit"
          disabled={isBusy}
          className="w-full rounded-sm bg-seal py-3 font-sans text-sm font-semibold tracking-wideish text-ink transition hover:bg-seal-bright disabled:opacity-50"
        >
          {isPending
            ? "Waiting for wallet confirmation..."
            : isConfirming
              ? "Writing to chain..."
              : "Create Escrow"}
        </button>
      </form>
    </div>
  );
}
