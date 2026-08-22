import type { Metadata } from "next";
import { Baloo_2, Quicksand } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });
const quicksand = Quicksand({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Pets Forever",
  description: "Your virtual pet, made from your real one.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${baloo.variable} ${quicksand.variable} font-[family-name:var(--font-body)] bg-[#FFF9EC] text-[#4A3222] min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
