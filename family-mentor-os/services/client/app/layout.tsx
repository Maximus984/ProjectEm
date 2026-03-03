import type { Metadata } from "next";
import { QueryProvider } from "../lib/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "FamilyMentor OS",
  description: "Diagnostic Intelligence Engine"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
