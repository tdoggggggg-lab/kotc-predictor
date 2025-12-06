import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "King of the Court Predictor",
  description: "DraftKings NBA PRA prediction model for King of the Court contest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
