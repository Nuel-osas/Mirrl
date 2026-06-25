import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BookText } from "lucide-react";
import "./globals.css";
import { MirrlProvider } from "@/lib/store";
import { TopNav } from "@/components/TopNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mirrl — the AI whose memory you own",
  description:
    "A personal AI whose entire memory lives on 0G — private inference, infinite memory, yours forever. Built for the 0G Zero Cup.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <MirrlProvider>
          <div className="flex h-screen flex-col bg-background text-foreground">
            <TopNav />
            <div className="relative flex flex-1 overflow-hidden">{children}</div>
          </div>
          <a
            href="https://docs.0g.ai"
            target="_blank"
            rel="noreferrer"
            className="fixed bottom-6 right-4 z-40 flex items-center gap-1.5 rounded-lg border border-border bg-surface/80 px-3 py-2 text-xs text-muted backdrop-blur hover:text-foreground transition-colors"
          >
            <BookText size={14} /> Docs
          </a>
        </MirrlProvider>
      </body>
    </html>
  );
}
