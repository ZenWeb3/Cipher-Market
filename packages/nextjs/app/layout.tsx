import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Indie_Flower } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Toaster } from "react-hot-toast";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const indieFlower = Indie_Flower({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-chat",
});

export const metadata: Metadata = {
  title: "Umbra — encrypted prediction markets",
  description: "Private prediction markets powered by FHE",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${spaceGrotesk.variable}  ${indieFlower.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Providers>
          {children}
          <Toaster position="bottom-right" toastOptions={{
            duration: 4000,
            style: { background: "#111", color: "#fafafa", border: "1px solid #1e1e1e", borderRadius: "8px", fontSize: "13px" },
            success: { style: { borderColor: "#22c55e" }, iconTheme: { primary: "#22c55e", secondary: "#000" } },
            error: { style: { borderColor: "#ef4444" }, iconTheme: { primary: "#ef4444", secondary: "#000" } },
          }} />
        </Providers>
      </body>
    </html>
  );
}