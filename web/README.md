# TrustEscrow — Web Interface (Built on Arc)

Next.js interface talking to the deployed `ArcEscrow` smart contract
(`0xa17B21d1117722938694ac11201628c8EC2BAe58`) on Arc Testnet.

> Branding note: per Circle's Arc partner guidelines, "Arc" cannot be
> incorporated into a product's own name (e.g. "Arc Payments" is listed as an
> incorrect example). The product is branded **TrustEscrow, built on Arc** —
> Arc is referenced descriptively, not as part of the product name. The
> smart contract's internal Solidity name (`ArcEscrow.sol`) is a technical
> identifier from before this rename and doesn't need to change for the
> guideline to be respected.

## Pages

- `/` — Intro, how it works
- `/create` — Seller: creates a new escrow, generates a shareable link
- `/escrow/[id]` — Escrow detail: status, seal timeline, role-based action buttons (pay, ship, confirm, dispute, arbiter resolution)
- `/my-escrows` — All escrows where the connected wallet is buyer or seller

## Setup

```bash
npm install
cp .env.local.example .env.local
```

`NEXT_PUBLIC_ARC_ESCROW_ADDRESS` in `.env.local` already points to the
deployed contract — no need to change it unless you redeploy.

## Run

```bash
npm run dev
```

Open `http://localhost:3000`. Make sure MetaMask is connected to Arc Testnet.

## Notes

- Wallet connection only supports **injected** wallets (MetaMask and similar
  browser wallets).
- Before paying, the buyer needs to `approve` the escrow contract to spend
  ERC-20 USDC — the UI handles this as a two-step button (1. Approve, 2.
  Lock).
- Dispute evidence is currently stored as a **link** only (e.g. a cloud
  storage link). Real file upload (IPFS/Pinata) can be added in v2.
- `/my-escrows` scans `EscrowCreated` events on-chain in 10,000-block chunks
  (Arc Testnet's RPC limits `eth_getLogs` to a 10,000-block range) — no
  backend or database required.

## Next steps

- [ ] Deploy to Vercel/Netlify (so anyone can access it)
- [ ] Real file storage for dispute evidence
- [ ] Demo video
