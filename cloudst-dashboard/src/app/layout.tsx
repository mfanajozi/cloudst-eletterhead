import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CloudST eLetterhead — Admin Dashboard",
  description:
    "White-label App Compiler SaaS. Compile corporate stationery templates into standalone Android, iOS, Windows & Web letterhead apps.",
  icons: {
    icon: "/cloudst-favicon.png",
    apple: "/cloudst-favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-charcoal-900 font-sans text-white">
        {children}
      </body>
    </html>
  );
}
