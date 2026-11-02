import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://bricdoc-raghuraj.vercel.app"),
  title: {
    default: "BricDoc — Everything your documents need. One intelligent workspace.",
    template: "%s | BricDoc",
  },
  description:
    "Production-ready all-in-one document productivity and intelligence platform. Organize, convert, edit, protect, and analyze PDF documents with real server-side processing.",
  keywords: [
    "BricDoc",
    "PDF tools",
    "Merge PDF",
    "Split PDF",
    "Compress PDF",
    "Word to PDF",
    "PDF to Word",
    "PDF Editor",
    "AI Document Assistant",
    "Convert PDF",
    "Protect PDF",
    "OCR PDF",
    "Free PDF tools",
  ],
  authors: [{ name: "Raghuraj Pratap Singh", url: "https://bricdoc-raghuraj.vercel.app" }],
  creator: "BricDoc",
  publisher: "BricDoc Platform",
  applicationName: "BricDoc",
  alternates: {
    canonical: "https://bricdoc-raghuraj.vercel.app",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://bricdoc-raghuraj.vercel.app",
    siteName: "BricDoc",
    title: "BricDoc — Everything your documents need. One intelligent workspace.",
    description:
      "Organize, convert, edit, protect, and analyze PDF documents with production-grade precision.",
  },
  twitter: {
    card: "summary_large_image",
    title: "BricDoc — All-in-One Document Intelligence & PDF Platform",
    description:
      "Organize, convert, edit, protect, and analyze PDF documents with production-grade precision.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "BricDoc",
  url: "https://bricdoc-raghuraj.vercel.app",
  description:
    "Production-ready all-in-one document productivity platform. Organize, convert, edit, protect, and analyze PDF documents with real server-side processing.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Android, iOS, Windows, macOS",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4f46e5",
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
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen flex flex-col justify-between">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
