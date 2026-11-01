import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { EducationalBanner } from "../components/EducationalBanner";
import { Navbar } from "../components/Navbar";
import { AuthProvider } from "../context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Educational Gaming Platform (Virtual Currency)",
  description: "Demonstration of concurrency-safe, verifiable transaction systems using virtual currency only.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <EducationalBanner />
          <Navbar />
          <main className="min-h-[calc(100vh-100px)]">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}

