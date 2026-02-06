import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ytaudio-dl.vercel.app";
const SITE_NAME = "YouTube Audio Downloader";
const SITE_DESCRIPTION =
  "Free online tool to download high-quality audio from YouTube videos. Extract audio as MP3, WAV, FLAC, AAC, OGG, or lossless original. Handles long videos (5+ hours).";

export const metadata: Metadata = {
  title: {
    default: "YouTube Audio Downloader — Extract MP3, WAV, FLAC from YouTube",
    template: "%s | YouTube Audio Downloader",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "youtube audio downloader",
    "youtube to mp3",
    "youtube to wav",
    "youtube to flac",
    "extract audio from youtube",
    "youtube audio extractor",
    "download youtube audio",
    "youtube mp3 converter",
    "youtube audio online",
    "lossless youtube audio",
    "long video audio download",
  ],
  authors: [{ name: "Conor Egan" }],
  creator: "Conor Egan",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "YouTube Audio Downloader — Extract MP3, WAV, FLAC from YouTube",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "YouTube Audio Downloader — Extract MP3, WAV, FLAC from YouTube",
    description: SITE_DESCRIPTION,
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

// JSON-LD Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Download audio from YouTube videos",
    "MP3, WAV, FLAC, AAC, M4A, OGG, Opus output formats",
    "Lossless original quality option",
    "Support for long videos (5+ hours)",
    "No video data downloaded — audio stream only",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-gradient-animated min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
