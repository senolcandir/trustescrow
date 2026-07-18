import localFont from "next/font/local";

export const displayFont = localFont({
  src: [
    { path: "./fonts/EBGaramond.ttf", weight: "400 800", style: "normal" },
    { path: "./fonts/EBGaramond-Italic.ttf", weight: "400 800", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const sansFont = localFont({
  src: [
    { path: "./fonts/IBMPlexSans.ttf", weight: "100 700", style: "normal" },
    { path: "./fonts/IBMPlexSans-Italic.ttf", weight: "100 700", style: "italic" },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const monoFont = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexMono-SemiBold.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});
