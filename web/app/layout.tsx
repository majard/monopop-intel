import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "monopop-intel",
  description: "Market price intelligence for Rio de Janeiro supermarkets.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <nav className="border-b border-zinc-800 px-6 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-6">
            <Link href="/" className="text-sm font-mono font-bold text-white hover:text-emerald-400 transition-colors">
              monopop<span className="text-emerald-400">-intel</span>
            </Link>
            <Link href="/history" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors">
              histórico
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
