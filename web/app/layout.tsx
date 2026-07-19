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
      <body className="min-h-screen overflow-x-hidden font-sans antialiased">
        <Providers>
          <header className="border-b border-ink-line/80">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6 sm:py-5">
              <Link href="/" className="flex items-center gap-2">
                <Logo className="h-6 w-6 shrink-0 text-seal-bright sm:h-7 sm:w-7" />
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display text-lg tracking-wideish text-paper sm:text-xl">
                    TrustEscrow
                  </span>
                  <span className="hidden font-mono text-[10px] uppercase tracking-label text-slate sm:inline">
                    built on arc
                  </span>
                </span>
              </Link>
              <nav className="flex flex-wrap items-center gap-3 font-sans text-xs text-paper/80 sm:gap-6 sm:text-sm">
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
          <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">{children}</main>
          <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-8 font-mono text-xs text-slate/70 sm:px-6 sm:py-10">
            <span>
              TrustEscrow doesn&apos;t sell products or host listings. It only
              secures payment. Built on Arc.
            </span>
            <a
              href="https://github.com/senolcandir/trustescrow"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-slate/70 transition hover:text-seal-bright"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              github.com/senolcandir/trustescrow
            </a>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
