import type { Metadata } from "next";
import { AppShell } from "../src/components/app-shell";
import "../../../brand-assets/design-system/tokens.css";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Conquest — Make conferences fun",
    template: "%s | Conquest",
  },
  description:
    "Great talks become quests. Strangers become allies. Your conference becomes an adventure.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
