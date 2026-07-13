import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { ThemeProvider } from "@/components/theme-provider";
import { SettingsInitializer } from "@/components/settings-initializer";
import { SITE_URL } from "@/lib/seo-config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CreatorTools - PDF Editor & Manager",
  description: "CreatorTools - Edit, convert, OCR, combine, and manage PDF files with AI-powered features. 18+ free online PDF tools.",
  keywords: ["PDF", "editor", "convert", "OCR", "combine", "compress", "CreatorTools", "QR code", "watermark", "sign", "compress"],
  authors: [{ name: "CreatorTools" }],
  icons: {
    icon: "/favicon.png",
  },
  verification: {
    google: "X90yH-RACjFH_y0J02x3MBeyzwAj_69JN4o4mmm3lTc",
  },
  other: {
    "impact-site-verification": "8590153c-162b-4ffa-a19c-14f34e747fc0",
  },
};

// JSON-LD Structured Data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "CreatorTools",
  "description": "CreatorTools - Edit, convert, OCR, combine, compress, watermark, sign, and manage PDF files with AI-powered features. 18+ free online PDF tools.",
  "url": SITE_URL,
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "Web Browser",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "featureList": [
    "PDF Compression",
    "PDF Conversion",
    "OCR Text Extraction",
    "PDF Merging",
    "eSignature & Signing",
    "Watermarking",
    "PDF Security & Encryption",
    "QR Code Generation",
    "Background Customization",
    "PDF Cropping",
    "Header & Footer",
    "Bates Numbering",
    "Batch Printing"
  ],
  "author": {
    "@type": "Organization",
    "name": "CreatorTools"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <SettingsInitializer />
          <Toaster />
          <SonnerToaster position="bottom-right" richColors />
          <FeedbackButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
