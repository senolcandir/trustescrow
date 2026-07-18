import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { displayFont, sansFont, monoFont } from "./fonts";
import { Providers } from "./providers";
import { ConnectButton } from "@/components/ConnectButton";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "TrustEscrow — Secure USDC Payments, Built on Arc",
  description:
    "A platform built on Arc that doesn't bring buyers and sellers together — it only secures the payment between them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          <header className="border-b border-ink-line/80">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
              <Link href="/" className="flex items-center gap-2.5">
                <Logo className="h-7 w-7 text-seal-bright" />
                <span className="flex items-baseline gap-2">
                  <span className="font-display text-xl tracking-wideish text-paper">
                    TrustEscrow
                  </span>
                  <span className="hidden font-mono text-[10px] uppercase tracking-label text-slate sm:inline">
                    built on arc
                  </span>
                </span>
              </Link>
              <nav className="flex items-center gap-6 font-sans text-sm text-paper/80">
                <Link href="/create" className="transition hover:text-seal-bright">
                  Create Escrow
                </Link>
                <Link href="/my-escrows" className="transition hover:text-seal-bright">
                  My Escrows
                </Link>
                <ConnectButton />
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>
          <footer className="mx-auto max-w-5xl px-6 py-10 font-mono text-xs text-slate/70">
            TrustEscrow doesn&apos;t sell products or host listings. It only secures payment. Built on Arc.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
