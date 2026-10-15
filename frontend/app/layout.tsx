import type { Metadata } from "next";
import "./globals.css";
import { WatchtowerProvider } from "@/components/watchtower-provider";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Watchtower — Slashing Monitoring & Insurance",
  description:
    "GenLayer intelligent contract that monitors protocols for violations and pays insurance from validator consensus.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <WatchtowerProvider>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </WatchtowerProvider>
      </body>
    </html>
  );
}
