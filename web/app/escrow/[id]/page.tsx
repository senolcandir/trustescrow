"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { ARC_ESCROW_ABI } from "@/lib/abi";
import { ERC20_ABI } from "@/lib/erc20Abi";
import { ARC_ESCROW_ADDRESS } from "@/lib/contract";
import { arcTestnet, ARC_USDC_ADDRESS, ARC_USDC_DECIMALS, ARC_EXPLORER_URL } from "@/lib/chains";
import { stateLabel, formatDuration, secondsUntil, isZeroAddress, isSafeHttpUrl } from "@/lib/format";
import { SealTimeline } from "@/components/SealTimeline";
import { AddressChip } from "@/components/AddressChip";
import { ConnectButton } from "@/components/ConnectButton";

const SHIP_TIMEOUT = 7n * 24n * 60n * 60n;
const AUTO_RELEASE_TIMEOUT = 14n * 24n * 60n * 60n;

type EscrowStruct = {
  seller: `0x${string}`;
  buyer: `0x${string}`;
  amount: bigint;
  state: number;
  trackingNumber: string;
  carrier: string;
  evidenceURI: string;
  lockedAt: bigint;
  shippedAt: bigint;
  disputeOpenedAt: bigint;
};

export default function EscrowDetailPage() {
  const params = useParams<{ id: string }>();
  const escrowId = BigInt(params.id);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onArc = chainId === arcTestnet.id;
  const nowSec = BigInt(Math.floor(Date.now() / 1000));

  const { data: escrow, refetch } = useReadContract({
    address: ARC_ESCROW_ADDRESS,
    abi: ARC_ESCROW_ABI,
    functionName: "getEscrow",
    args: [escrowId],
    query: { refetchInterval: 15000 },
  }) as { data: EscrowStruct | undefined; refetch: () => void };

  if (!isConnected) {
    return (
      <Centered title="Connect your wallet first">
        <ConnectButton />
      </Centered>
    );
  }

  if (!onArc) {
    return (
      <Centered title="Wrong network" tone="ember">
        <ConnectButton />
      </Centered>
    );
  }

  if (!escrow || isZeroAddress(escrow.seller)) {
    return (
      <Centered title="Escrow not found">
        <p className="font-sans text-sm text-paper/60">
          Escrow #{escrowId.toString()} was not found on-chain. Check with
          whoever sent you this link.
        </p>
      </Centered>
    );
  }

  const isSeller = address?.toLowerCase() === escrow.seller.toLowerCase();
  const isBuyer = address?.toLowerCase() === escrow.buyer.toLowerCase();
  const role = isSeller ? "Seller" : isBuyer ? "Buyer" : "Observer";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-label text-seal-bright">
          Escrow #{escrowId.toString()} · You: {role}
        </p>
        <a
          href={`${ARC_EXPLORER_URL}/address/${ARC_ESCROW_ADDRESS}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-slate hover:text-seal-bright"
        >
          Explorer &#8599;
        </a>
      </div>

      <div className="mt-4 rounded-sm border border-ink-line bg-ink-soft p-6 paper-texture">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-display text-4xl text-paper">
            {formatUnits(escrow.amount, ARC_USDC_DECIMALS)}{" "}
            <span className="text-xl text-slate">USDC</span>
          </span>
          <span className="font-sans text-sm font-medium uppercase tracking-label text-seal-bright">
            {stateLabel(escrow.state)}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2">
          <AddressChip label="Seller" address={escrow.seller} />
          <AddressChip label="Buyer" address={escrow.buyer} />
        </div>

        <div className="mt-8">
          <SealTimeline state={escrow.state} shippedAt={escrow.shippedAt} />
        </div>

        {escrow.trackingNumber && (
          <div className="mt-6 border-t border-ink-line pt-4 font-mono text-sm text-paper/80">
            Shipping: {escrow.carrier || "-"} · Tracking No: {escrow.trackingNumber}
          </div>
        )}

        {escrow.evidenceURI && (
          <div className="mt-3 font-mono text-sm text-paper/80 break-all">
            Dispute evidence:{" "}
            {isSafeHttpUrl(escrow.evidenceURI) ? (
              <a
                href={escrow.evidenceURI}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-slate hover:text-seal-bright"
              >
                {escrow.evidenceURI}
              </a>
            ) : (
              <span title="This isn't a valid link, showing as plain text">
                {escrow.evidenceURI}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-6">
        <ActionPanel
          escrowId={escrowId}
          escrow={escrow}
          isSeller={isSeller}
          isBuyer={isBuyer}
          nowSec={nowSec}
          onChanged={refetch}
        />
      </div>
    </div>
  );
}

function Centered({
  title,
  tone = "seal",
  children,
}: {
  title: string;
  tone?: "seal" | "ember";
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`mx-auto max-w-md rounded-sm border p-8 text-center ${
        tone === "ember" ? "border-ember/40 bg-ember/10" : "border-ink-line bg-ink-soft"
      }`}
    >
      <p className="font-display text-xl text-paper">{title}</p>
      <div className="mt-6 flex justify-center">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action panel: shows the right buttons based on state + role
// ---------------------------------------------------------------------------

function ActionPanel({
  escrowId,
  escrow,
  isSeller,
  isBuyer,
  nowSec,
  onChanged,
}: {
  escrowId: bigint;
  escrow: EscrowStruct;
  isSeller: boolean;
  isBuyer: boolean;
  nowSec: bigint;
  onChanged: () => void;
}) {
  if (escrow.state === 0 && isSeller) return <CancelPanel escrowId={escrowId} onChanged={onChanged} />;
  if (escrow.state === 0 && isBuyer) return <PayPanel escrowId={escrowId} escrow={escrow} onChanged={onChanged} />;
  if (escrow.state === 2 && isSeller) return <ShipPanel escrowId={escrowId} onChanged={onChanged} />;
  if (escrow.state === 2 && isBuyer)
    return <LockedBuyerPanel escrowId={escrowId} escrow={escrow} nowSec={nowSec} onChanged={onChanged} />;
  if (escrow.state === 3 && isBuyer)
    return <ShippedBuyerPanel escrowId={escrowId} escrow={escrow} nowSec={nowSec} onChanged={onChanged} />;
  if (escrow.state === 3 && !isBuyer && !isSeller)
    return <AutoReleaseHint escrow={escrow} nowSec={nowSec} escrowId={escrowId} onChanged={onChanged} />;
  if (escrow.state === 4) return <DisputePanel escrowId={escrowId} escrow={escrow} onChanged={onChanged} />;

  return (
    <p className="rounded-sm border border-ink-line bg-ink-soft p-5 font-sans text-sm text-paper/60">
      There&apos;s nothing for you to do on this escrow right now. Status:{" "}
      <span className="text-paper">{stateLabel(escrow.state)}</span>
    </p>
  );
}

function TxButton({
  onClick,
  isPending,
  isConfirming,
  label,
  pendingLabel = "Waiting for wallet confirmation...",
  confirmingLabel = "Writing to chain...",
  tone = "seal",
  disabled,
}: {
  onClick: () => void;
  isPending: boolean;
  isConfirming: boolean;
  label: string;
  pendingLabel?: string;
  confirmingLabel?: string;
  tone?: "seal" | "ember" | "moss";
  disabled?: boolean;
}) {
  const toneClasses = {
    seal: "bg-seal hover:bg-seal-bright text-ink",
    ember: "bg-ember hover:bg-ember-bright text-paper",
    moss: "bg-moss hover:bg-moss-bright text-paper",
  }[tone];

  return (
    <button
      onClick={onClick}
      disabled={disabled || isPending || isConfirming}
      className={`w-full rounded-sm py-3 font-sans text-sm font-semibold tracking-wideish transition disabled:opacity-50 ${toneClasses}`}
    >
      {isPending ? pendingLabel : isConfirming ? confirmingLabel : label}
    </button>
  );
}

function CancelPanel({ escrowId, onChanged }: { escrowId: bigint; onChanged: () => void }) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  if (isSuccess) onChanged();

  return (
    <div className="rounded-sm border border-ink-line bg-ink-soft p-5">
      <p className="font-sans text-sm text-paper/70">
        Payment hasn&apos;t been locked yet. You can cancel this escrow if you
        want.
      </p>
      <div className="mt-4">
        <TxButton
          tone="ember"
          label="Cancel Escrow"
          isPending={isPending}
          isConfirming={isConfirming}
          onClick={() =>
            writeContract({
              address: ARC_ESCROW_ADDRESS,
              abi: ARC_ESCROW_ABI,
              functionName: "cancelEscrow",
              args: [escrowId],
            })
          }
        />
      </div>
    </div>
  );
}

function PayPanel({
  escrowId,
  escrow,
  onChanged,
}: {
  escrowId: bigint;
  escrow: EscrowStruct;
  onChanged: () => void;
}) {
  const { address } = useAccount();

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ARC_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, ARC_ESCROW_ADDRESS] : undefined,
    query: { enabled: !!address, refetchInterval: 10000 },
  });

  const { data: usdcBalance } = useReadContract({
    address: ARC_USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: gasBalance } = useBalance({ address, chainId: arcTestnet.id });

  const needsApproval = (allowance ?? 0n) < escrow.amount;
  const insufficientUsdc = (usdcBalance ?? 0n) < escrow.amount;
  const noGas = (gasBalance?.value ?? 0n) === 0n;

  const approveWrite = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approveWrite.data });
  if (approveReceipt.isSuccess) refetchAllowance();

  const payWrite = useWriteContract();
  const payReceipt = useWaitForTransactionReceipt({ hash: payWrite.data });
  if (payReceipt.isSuccess) onChanged();

  return (
    <div className="rounded-sm border border-ink-line bg-ink-soft p-5">
      <p className="font-sans text-sm text-paper/70">
        To lock the payment, you first need to approve{" "}
        {formatUnits(escrow.amount, ARC_USDC_DECIMALS)} USDC for spending, then
        lock it.
      </p>

      {insufficientUsdc && (
        <p className="mt-3 rounded-sm bg-ember/10 px-3 py-2 font-sans text-sm text-ember-bright">
          Your wallet doesn&apos;t have enough ERC-20 USDC. This is different
          from the native USDC you use for gas.
        </p>
      )}
      {noGas && (
        <p className="mt-3 rounded-sm bg-ember/10 px-3 py-2 font-sans text-sm text-ember-bright">
          Your wallet doesn&apos;t seem to have a native USDC balance for gas.
          Transactions may fail to send.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {needsApproval ? (
          <TxButton
            label="1. Approve USDC Spending"
            isPending={approveWrite.isPending}
            isConfirming={approveReceipt.isLoading}
            onClick={() =>
              approveWrite.writeContract({
                address: ARC_USDC_ADDRESS,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [ARC_ESCROW_ADDRESS, escrow.amount],
              })
            }
          />
        ) : (
          <TxButton
            label="2. Lock Payment (Pay with USDC)"
            isPending={payWrite.isPending}
            isConfirming={payReceipt.isLoading}
            disabled={insufficientUsdc}
            onClick={() =>
              payWrite.writeContract({
                address: ARC_ESCROW_ADDRESS,
                abi: ARC_ESCROW_ABI,
                functionName: "pay",
                args: [escrowId],
              })
            }
          />
        )}
      </div>
    </div>
  );
}

function ShipPanel({ escrowId, onChanged }: { escrowId: bigint; onChanged: () => void }) {
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  if (isSuccess) onChanged();

  return (
    <div className="rounded-sm border border-ink-line bg-ink-soft p-5">
      <p className="font-sans text-sm text-paper/70">
        Payment is locked. Once you ship the item, enter the tracking number
        and report it.
      </p>
      <div className="mt-4 space-y-3">
        <input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Tracking number"
          className="w-full rounded-sm border border-ink-line bg-ink px-4 py-3 font-mono text-sm text-paper placeholder:text-slate/50 focus:border-seal/60"
        />
        <input
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          placeholder="Carrier (optional)"
          className="w-full rounded-sm border border-ink-line bg-ink px-4 py-3 font-sans text-sm text-paper placeholder:text-slate/50 focus:border-seal/60"
        />
        {error && (
          <p className="rounded-sm bg-ember/10 px-3 py-2 font-sans text-sm text-ember-bright">
            The transaction failed. Make sure the tracking number isn&apos;t
            empty.
          </p>
        )}
        <TxButton
          label="Mark as Shipped"
          isPending={isPending}
          isConfirming={isConfirming}
          disabled={tracking.trim().length === 0}
          onClick={() =>
            writeContract({
              address: ARC_ESCROW_ADDRESS,
              abi: ARC_ESCROW_ABI,
              functionName: "markShipped",
              args: [escrowId, tracking.trim(), carrier.trim()],
            })
          }
        />
      </div>
    </div>
  );
}

function LockedBuyerPanel({
  escrowId,
  escrow,
  nowSec,
  onChanged,
}: {
  escrowId: bigint;
  escrow: EscrowStruct;
  nowSec: bigint;
  onChanged: () => void;
}) {
  const refundEligible = nowSec >= escrow.lockedAt + SHIP_TIMEOUT;
  const remaining = secondsUntil(escrow.lockedAt + SHIP_TIMEOUT, nowSec);

  const refundWrite = useWriteContract();
  const refundReceipt = useWaitForTransactionReceipt({ hash: refundWrite.data });
  if (refundReceipt.isSuccess) onChanged();

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-ink-line bg-ink-soft p-5">
        <p className="font-sans text-sm text-paper/70">
          Payment is locked, waiting for the seller to ship.{" "}
          {refundEligible
            ? "Time's up, you can get a refund now."
            : `You can get a refund in ${formatDuration(remaining)} if the seller doesn't ship.`}
        </p>
        <div className="mt-4">
          <TxButton
            label="Refund My Payment"
            tone="ember"
            disabled={!refundEligible}
            isPending={refundWrite.isPending}
            isConfirming={refundReceipt.isLoading}
            onClick={() =>
              refundWrite.writeContract({
                address: ARC_ESCROW_ADDRESS,
                abi: ARC_ESCROW_ABI,
                functionName: "refundIfNotShipped",
                args: [escrowId],
              })
            }
          />
        </div>
      </div>
      <OpenDisputeForm escrowId={escrowId} onChanged={onChanged} />
    </div>
  );
}

function ShippedBuyerPanel({
  escrowId,
  escrow,
  nowSec,
  onChanged,
}: {
  escrowId: bigint;
  escrow: EscrowStruct;
  nowSec: bigint;
  onChanged: () => void;
}) {
  const remaining = secondsUntil(escrow.shippedAt + AUTO_RELEASE_TIMEOUT, nowSec);

  const confirmWrite = useWriteContract();
  const confirmReceipt = useWaitForTransactionReceipt({ hash: confirmWrite.data });
  if (confirmReceipt.isSuccess) onChanged();

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-ink-line bg-ink-soft p-5">
        <p className="font-sans text-sm text-paper/70">
          The item has shipped{escrow.trackingNumber ? ` (${escrow.carrier || "carrier"}: ${escrow.trackingNumber})` : ""}.
          Confirm once you've received it — funds go to the seller.
        </p>
        <p className="mt-2 font-mono text-xs text-slate">
          If you don&apos;t confirm, funds auto-release to the seller in{" "}
          {formatDuration(remaining)}.
        </p>
        <div className="mt-4">
          <TxButton
            label="I Received My Order (Confirm)"
            tone="moss"
            isPending={confirmWrite.isPending}
            isConfirming={confirmReceipt.isLoading}
            onClick={() =>
              confirmWrite.writeContract({
                address: ARC_ESCROW_ADDRESS,
                abi: ARC_ESCROW_ABI,
                functionName: "confirmReceived",
                args: [escrowId],
              })
            }
          />
        </div>
      </div>
      <OpenDisputeForm escrowId={escrowId} onChanged={onChanged} />
    </div>
  );
}

function AutoReleaseHint({
  escrow,
  nowSec,
  escrowId,
  onChanged,
}: {
  escrow: EscrowStruct;
  nowSec: bigint;
  escrowId: bigint;
  onChanged: () => void;
}) {
  const eligible = nowSec >= escrow.shippedAt + AUTO_RELEASE_TIMEOUT;
  const remaining = secondsUntil(escrow.shippedAt + AUTO_RELEASE_TIMEOUT, nowSec);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  if (isSuccess) onChanged();

  return (
    <div className="rounded-sm border border-ink-line bg-ink-soft p-5">
      <p className="font-sans text-sm text-paper/70">
        {eligible
          ? "The auto-release period has passed. Anyone can trigger it."
          : `You don't have a role in this escrow. Auto-release is available in ${formatDuration(remaining)}.`}
      </p>
      {eligible && (
        <div className="mt-4">
          <TxButton
            label="Trigger Auto-Release"
            isPending={isPending}
            isConfirming={isConfirming}
            onClick={() =>
              writeContract({
                address: ARC_ESCROW_ADDRESS,
                abi: ARC_ESCROW_ABI,
                functionName: "autoRelease",
                args: [escrowId],
              })
            }
          />
        </div>
      )}
    </div>
  );
}

function OpenDisputeForm({ escrowId, onChanged }: { escrowId: bigint; onChanged: () => void }) {
  const [evidence, setEvidence] = useState("");
  const [linkWarning, setLinkWarning] = useState<string | null>(null);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  if (isSuccess) onChanged();

  function handleSubmit() {
    setLinkWarning(null);
    const trimmed = evidence.trim();

    if (trimmed.length === 0) {
      writeContract({
        address: ARC_ESCROW_ADDRESS,
        abi: ARC_ESCROW_ABI,
        functionName: "openDispute",
        args: [escrowId, ""],
      });
      return;
    }

    // If the person forgot the protocol (e.g. "drive.google.com/..."), add it
    // automatically so the stored link is actually clickable later, instead
    // of silently saving a broken relative link.
    let normalized = trimmed;
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = `https://${normalized}`;
    }

    if (!isSafeHttpUrl(normalized)) {
      setLinkWarning(
        "That doesn't look like a valid link. Double-check it, or leave the field empty."
      );
      return;
    }

    writeContract({
      address: ARC_ESCROW_ADDRESS,
      abi: ARC_ESCROW_ABI,
      functionName: "openDispute",
      args: [escrowId, normalized],
    });
  }

  return (
    <div className="rounded-sm border border-ember/30 bg-ember/5 p-5">
      <p className="font-sans text-sm font-medium text-ember-bright">Something wrong?</p>
      <p className="mt-1 font-sans text-sm text-paper/60">
        Opening a dispute brings in an independent arbiter. You can add a
        photo/description link (e.g. a cloud storage link) as evidence.
      </p>
      <div className="mt-3 space-y-3">
        <input
          value={evidence}
          onChange={(e) => {
            setEvidence(e.target.value);
            setLinkWarning(null);
          }}
          placeholder="Evidence link (optional)"
          className="w-full rounded-sm border border-ink-line bg-ink px-4 py-3 font-mono text-sm text-paper placeholder:text-slate/50 focus:border-ember/60"
        />
        {linkWarning && (
          <p className="rounded-sm bg-ember/10 px-3 py-2 font-sans text-sm text-ember-bright">
            {linkWarning}
          </p>
        )}
        {error && (
          <p className="rounded-sm bg-ember/10 px-3 py-2 font-sans text-sm text-ember-bright">
            The transaction failed or was rejected.
          </p>
        )}
        <TxButton
          label="Open Dispute"
          tone="ember"
          isPending={isPending}
          isConfirming={isConfirming}
          onClick={handleSubmit}
        />
      </div>
    </div>
  );
}

function DisputePanel({
  escrowId,
  escrow,
  onChanged,
}: {
  escrowId: bigint;
  escrow: EscrowStruct;
  onChanged: () => void;
}) {
  const { address } = useAccount();
  const { data: arbiter } = useReadContract({
    address: ARC_ESCROW_ADDRESS,
    abi: ARC_ESCROW_ABI,
    functionName: "arbiter",
  });
  const isArbiter = !!address && !!arbiter && address.toLowerCase() === (arbiter as string).toLowerCase();

  const [buyerPct, setBuyerPct] = useState(50);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  if (isSuccess) onChanged();

  const buyerAmount = (escrow.amount * BigInt(buyerPct)) / 100n;
  const sellerAmount = escrow.amount - buyerAmount;

  if (!isArbiter) {
    return (
      <div className="rounded-sm border border-ember/30 bg-ember/5 p-5">
        <p className="font-sans text-sm text-paper/70">
          A dispute has been opened. Waiting on the independent arbiter&apos;s
          decision. Funds will be distributed automatically once resolved.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-ember/30 bg-ember/5 p-5">
      <p className="font-sans text-sm font-medium text-ember-bright">Arbiter Panel</p>
      <p className="mt-1 font-sans text-sm text-paper/60">
        Review the evidence and split the amount between buyer and seller.
      </p>

      <div className="mt-4">
        <input
          type="range"
          min={0}
          max={100}
          value={buyerPct}
          onChange={(e) => setBuyerPct(Number(e.target.value))}
          className="w-full accent-seal"
        />
        <div className="mt-2 flex justify-between font-mono text-sm">
          <span className="text-paper">
            Buyer: {formatUnits(buyerAmount, ARC_USDC_DECIMALS)} USDC
          </span>
          <span className="text-paper">
            Seller: {formatUnits(sellerAmount, ARC_USDC_DECIMALS)} USDC
          </span>
        </div>
      </div>

      <div className="mt-4">
        <TxButton
          label="Apply Resolution"
          isPending={isPending}
          isConfirming={isConfirming}
          onClick={() =>
            writeContract({
              address: ARC_ESCROW_ADDRESS,
              abi: ARC_ESCROW_ABI,
              functionName: "resolveDispute",
              args: [escrowId, buyerAmount, sellerAmount],
            })
          }
        />
      </div>
    </div>
  );
}
