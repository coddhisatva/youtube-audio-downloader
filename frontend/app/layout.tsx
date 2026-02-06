import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YouTube Audio Downloader",
  description:
    "Download high-quality audio from YouTube videos. Supports MP3, WAV, FLAC, and more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gradient-animated min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
