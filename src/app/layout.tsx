import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutonomoPay — Trust Infrastructure for Autonomous AI Commerce",
  description: "AI-native financial infrastructure for autonomous agent-to-agent commerce with programmable contracts, verification, and PayPal settlement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <body className="min-h-full flex flex-col bg-[#040711] text-[#E2E8F0] selection:bg-cyan-500/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
