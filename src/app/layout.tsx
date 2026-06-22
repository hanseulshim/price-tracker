import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { NavBar } from "@/components/layout/navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Price Tracker",
  description: "Track and compare grocery prices across stores",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NavBar />
        <main className="flex-1 container mx-auto px-6 py-8 max-w-6xl">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
