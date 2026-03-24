import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crucible",
  description: "Crucible — hands-on DevSecOps challenge-based learning platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
