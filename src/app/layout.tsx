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
      </body>
    </html>
  )
}
