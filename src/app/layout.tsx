import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BookText } from "lucide-react";
import { Toaster } from "sonner";
import "./globals.css";
import { MirrlProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";
import { TopNav } from "@/components/TopNav";
import { IdentitySync } from "@/components/IdentitySync";
import { SignInModal } from "@/components/SignInModal";
import { ClaimModal } from "@/components/ClaimModal";
import { ProfileModal } from "@/components/ProfileModal";
import { ExtensionErrorGuard } from "@/components/ExtensionErrorGuard";

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
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-x-hidden antialiased`}
    >
      <head>
        {/* Swallow wallet-extension injection clashes (e.g. "Cannot redefine
            property: ethereum") before hydration so they don't crash the app. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function ext(m,s,k){return (s&&s.indexOf('chrome-extension://')===0)||(k&&k.indexOf('chrome-extension://')>=0)||(m&&/redefine property: ethereum|already been defined|Cannot set property ethereum/i.test(m));}window.addEventListener('error',function(e){if(ext(e.message,e.filename,e.error&&e.error.stack)){e.stopImmediatePropagation();e.preventDefault();}},true);window.addEventListener('unhandledrejection',function(e){var r=e.reason||{};if(ext(r.message,'',r.stack)){e.stopImmediatePropagation();e.preventDefault();}},true);})();`,
          }}
        />
      </head>
      <body className="min-h-full overflow-x-hidden">
        <AuthProvider>
          <MirrlProvider>
              <ExtensionErrorGuard />
              <IdentitySync />
              <SignInModal />
              <ClaimModal />
              <ProfileModal />
              <Toaster theme="dark" position="bottom-center" toastOptions={{ style: { background: "var(--surface)", border: "1px solid var(--border-strong)", color: "var(--foreground)" } }} />
              <div className="flex h-screen flex-col bg-background text-foreground">
                <TopNav />
                <div className="relative flex flex-1 overflow-hidden [&>*]:min-w-0 [&>*]:flex-1">{children}</div>
              </div>
              <a
                href="https://docs.0g.ai"
                target="_blank"
                rel="noreferrer"
                className="fixed bottom-6 right-4 z-40 hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-surface/80 px-3 py-2 text-xs text-muted backdrop-blur hover:text-foreground transition-colors"
              >
                <BookText size={14} /> Docs
              </a>
          </MirrlProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
