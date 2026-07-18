import Link from "next/link";
import { SealTimeline } from "@/components/SealTimeline";

export default function HomePage() {
  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="grid gap-10 md:grid-cols-[1.3fr_1fr] md:items-center">
        <div>
          <p className="mb-4 font-mono text-xs uppercase tracking-label text-seal-bright">
            Arc Testnet · Decentralized Escrow
          </p>
          <h1 className="font-display text-4xl leading-[1.15] text-paper sm:text-5xl">
            Two wallet addresses.
            <br />
            One sealed deal.
          </h1>
          <p className="mt-6 max-w-lg font-sans text-base leading-relaxed text-paper/75">
            TrustEscrow is not a marketplace. It doesn&apos;t sell products, host
            listings, or bring buyers and sellers together. You already made the
            deal — on Facebook Marketplace, Telegram, or Instagram. We just make
            the payment safe.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/create"
              className="rounded-sm bg-seal px-6 py-3 font-sans text-sm font-semibold tracking-wideish text-ink transition hover:bg-seal-bright"
            >
              I&apos;m Selling — Create Escrow
            </Link>
            <Link
              href="/my-escrows"
              className="rounded-sm border border-slate/40 px-6 py-3 font-sans text-sm font-semibold tracking-wideish text-paper/90 transition hover:border-seal/60"
            >
              I Have a Pending Payment
            </Link>
          </div>
        </div>

        <div className="rounded-sm border border-ink-line bg-ink-soft p-6 paper-texture">
          <p className="mb-5 font-mono text-[11px] uppercase tracking-label text-slate">
            Example flow — Preview
          </p>
          <SealTimeline state={3} shippedAt={1n} />
          <dl className="mt-8 space-y-3 font-mono text-sm">
            <div className="flex justify-between border-b border-ink-line pb-2">
              <dt className="text-slate">Amount</dt>
              <dd className="tabular text-paper">5 USDC</dd>
            </div>
            <div className="flex justify-between border-b border-ink-line pb-2">
              <dt className="text-slate">Shipping</dt>
              <dd className="text-paper">FastPost · TRK 44120</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate">Auto-release</dt>
              <dd className="text-paper">13 days 22 hours</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="font-display text-2xl text-paper">How it works</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {[
            {
              n: "01",
              title: "Agree, share wallets",
              body: "Agree on the item and price with the other party, then share only your wallet addresses over DM.",
            },
            {
              n: "02",
              title: "Seller sets up, buyer locks",
              body: "The seller creates the escrow, the buyer locks the USDC into the contract. The money now sits in neither wallet — it's held by the contract.",
            },
            {
              n: "03",
              title: "Deliver, confirm, release",
              body: "The seller ships, the buyer confirms on delivery. If confirmation doesn't come, funds auto-release after 14 days.",
            },
          ].map((step) => (
            <div key={step.n} className="border-t border-seal/40 pt-4">
              <span className="font-display text-3xl text-seal-dim">{step.n}</span>
              <h3 className="mt-2 font-sans text-base font-semibold text-paper">
                {step.title}
              </h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-paper/65">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Guarantees */}
      <section className="rounded-sm border border-ink-line bg-ink-soft p-8">
        <h2 className="font-display text-2xl text-paper">
          Funds are never stuck
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="font-sans text-sm font-semibold text-moss-bright">
              If the seller doesn&apos;t ship
            </p>
            <p className="mt-1 font-sans text-sm leading-relaxed text-paper/70">
              The buyer gets a refund with one click after 7 days — no dispute
              needed.
            </p>
          </div>
          <div>
            <p className="font-sans text-sm font-semibold text-moss-bright">
              If the buyer doesn&apos;t confirm
            </p>
            <p className="mt-1 font-sans text-sm leading-relaxed text-paper/70">
              Funds auto-release to the seller 14 days after shipment is
              reported.
            </p>
          </div>
          <div>
            <p className="font-sans text-sm font-semibold text-ember-bright">
              If something goes wrong
            </p>
            <p className="mt-1 font-sans text-sm leading-relaxed text-paper/70">
              The buyer opens a dispute and uploads evidence. An independent
              arbiter applies a full or partial (e.g. 50/50) resolution.
            </p>
          </div>
          <div>
            <p className="font-sans text-sm font-semibold text-paper">
              Every step on-chain
            </p>
            <p className="mt-1 font-sans text-sm leading-relaxed text-paper/70">
              Nothing is hidden — every escrow and every transfer is publicly
              visible on the Arc Testnet explorer.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
