import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-newsreader",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AskCampus — Campus Knowledge, Deadline Radar & Action OS",
  description:
    "Verified university circular intelligence, anti-fine deadline radar, WhatsApp rumor fact-checker, and dynamic attendance rule simulator.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="min-h-dvh bg-[#F7F8FA] text-[#0F172A] antialiased">
        {children}
      </body>
    </html>
  );
}
