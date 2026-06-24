import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { AppStateProvider } from "@/components/providers/app-state-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Trevor's SAT Suite",
    template: "%s | Trevor's SAT Suite",
  },
  description:
    "Private SAT practice, testing, and performance analysis for Trevor's students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ "--font-app": "Arial" } as React.CSSProperties}>
        <AppStateProvider>{children}</AppStateProvider>
        <Analytics />
      </body>
    </html>
  );
}
