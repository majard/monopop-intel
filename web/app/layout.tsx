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
        <nav className="border-b bg-zinc-950 border-zinc-800">
          <div className="max-w-3xl mx-auto px-6 py-2 flex items-baseline justify-between">
            <div className="flex flex-col">
              <Link href="/" className="font-mono font-bold text-white hover:text-emerald-400 transition-colors text-2xl tracking-tighter">
                monopop<span className="text-emerald-400">-intel</span>
              </Link>
              <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] mt-1 ml-0.5">
                market price intelligence · rj
              </p>
            </div>

            <div className="flex items-center gap-6">
              <Link
                href="/history"
                className="text-xs font-mono text-zinc-500 hover:text-emerald-400 transition-colors"
              >
                histórico
              </Link>
              <Link
                href="/generics"
                className="text-xs font-mono text-zinc-500 hover:text-emerald-400 transition-colors"
              >
                básicos
              </Link>
              <Link
                href="/shopping-lists"
                className="text-xs font-mono text-zinc-500 hover:text-emerald-400 transition-colors"
              >
                listas
              </Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
