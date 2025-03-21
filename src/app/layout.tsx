// app/layout.tsx

import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Analytics } from "@vercel/analytics/react" // Import Analytics

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Spelling B-",
  description: "Test your spelling skills!",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
        <Analytics /> {/* Include Analytics */}
        
        {/* Vibe Jam 2025 Link */}
        <a 
          target="_blank" 
          href="https://jam.pieter.com" 
          style={{
            fontFamily: "'system-ui', sans-serif",
            position: "fixed",
            bottom: "-1px",
            right: "-1px",
            padding: "7px",
            fontSize: "14px",
            fontWeight: "bold",
            background: "#fff",
            color: "#000",
            textDecoration: "none",
            zIndex: 10000,
            borderTopLeftRadius: "12px",
            border: "1px solid #fff"
          }}
        >
          🕹️ Vibe Jam 2025
        </a>
      </body>
    </html>
  )
}