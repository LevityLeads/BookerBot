import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "BookerBot - AI Appointment Booking",
  description: "AI-powered appointment booking automation platform",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
