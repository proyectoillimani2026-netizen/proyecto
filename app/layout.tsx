import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { TabSession } from "@/components/TabSession";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Illimani Eats",
  description: "Pedí empanadas, pizzas y platos. General Paz 59, Ciudad de Mendoza.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${outfit.variable} ${fraunces.variable}`}>
        <TabSession />
        {children}
      </body>
    </html>
  );
}
