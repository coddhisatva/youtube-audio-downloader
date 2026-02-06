"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AudioFormat {
  format_id: string;
  ext: string;
  acodec: string;
  abr: number | null;
  asr: number | null;
  filesize: number | null;
  format_note: string;
}

interface VideoInfo {
  title: string;
  duration: number;
  duration_string: string;
  thumbnail: string;
  channel: string;
  view_count: number;
  upload_date: string;
  audio_formats: AudioFormat[];
  output_formats: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const FORMAT_LABELS: Record<string, { label: string; description: string }> = {
  mp3:      { label: "MP3",      description: "Universal compatibility" },
  wav:      { label: "WAV",      description: "Uncompressed lossless" },
  flac:     { label: "FLAC",     description: "Compressed lossless" },
  aac:      { label: "AAC",      description: "High efficiency" },
  m4a:      { label: "M4A",      description: "Apple / iTunes" },
  ogg:      { label: "OGG",      description: "Open source format" },
  opus:     { label: "Opus",     description: "Modern & efficient" },
  original: { label: "Original", description: "Native stream, no re-encode" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return "";
  const y = dateStr.slice(0, 4);
  const m = dateStr.slice(4, 6);
  const d = dateStr.slice(6, 8);
  return `${y}-${m}-${d}`;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function Spinner() {
  return <div className="spinner" />;
}

function FormatCard({
  format,
  selected,
  onClick,
}: {
  format: string;
  selected: boolean;
  onClick: () => void;
}) {
  const info = FORMAT_LABELS[format] || { label: format, description: "" };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative rounded-xl border px-4 py-3 text-left transition-all duration-200
        cursor-pointer
        ${
          selected
            ? "border-accent bg-accent/10 shadow-[0_0_20px_rgba(124,58,237,0.15)]"
            : "border-border bg-bg-card hover:border-accent/40 hover:bg-bg-card-hover"
        }
      `}
    >
      <div className="font-semibold text-text-primary text-sm">
        {info.label}
      </div>
      <div className="text-text-muted text-xs mt-0.5">{info.description}</div>
      {selected && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Home() {
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState("mp3");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  // Fetch video info
  async function handleFetchInfo(e: FormEvent) {
    e.preventDefault();
    setError("");
    setVideoInfo(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please enter a YouTube URL.");
      return;
    }

    if (!extractYouTubeId(trimmed)) {
      setError("That doesn't look like a valid YouTube URL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/info?url=${encodeURIComponent(trimmed)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to fetch video info.");
        return;
      }
      setVideoInfo(data);
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  // Trigger download
  function handleDownload() {
    if (!videoInfo) return;
    setDownloading(true);
    setError("");

    const downloadUrl = `${API_URL}/api/download?url=${encodeURIComponent(
      url.trim()
    )}&format=${selectedFormat}`;

    // Open in a hidden iframe / new anchor so the browser handles the download natively
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // We can't truly know when the download finishes from JS.
    // Show the "downloading" state for a few seconds then reset.
    setTimeout(() => setDownloading(false), 5000);
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12 sm:py-20">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 mb-4">
          <svg
            className="w-8 h-8 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V4.5A2.25 2.25 0 0017.25 2.25H15M9 9v10.5A2.25 2.25 0 016.75 21.75H4.5"
            />
          </svg>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            YouTube Audio Downloader
          </h1>
        </div>
        <p className="text-text-secondary max-w-lg mx-auto">
          Extract high-quality audio directly from YouTube videos. Supports long
          content (5+ hours), multiple formats, and lossless quality.
        </p>
      </div>

      {/* URL Input */}
      <form
        onSubmit={handleFetchInfo}
        className="w-full max-w-2xl flex gap-3 mb-6"
      >
        <div className="flex-1 relative">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube URL..."
            className="
              w-full rounded-xl border border-border bg-bg-card px-4 py-3.5
              text-text-primary placeholder:text-text-muted
              focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30
              transition-colors
            "
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="
            rounded-xl bg-accent hover:bg-accent-hover px-6 py-3.5
            font-semibold text-white transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center gap-2 cursor-pointer
          "
        >
          {loading ? (
            <>
              <Spinner /> Fetching…
            </>
          ) : (
            "Get Info"
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="w-full max-w-2xl mb-6 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-error text-sm">
          {error}
        </div>
      )}

      {/* Video Info Card */}
      {videoInfo && (
        <div className="w-full max-w-2xl rounded-2xl border border-border bg-bg-card overflow-hidden mb-8">
          {/* Thumbnail + info row */}
          <div className="flex flex-col sm:flex-row">
            {videoInfo.thumbnail && (
              <div className="relative sm:w-72 h-44 sm:h-auto flex-shrink-0 bg-black">
                <Image
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <div className="flex-1 p-5">
              <h2 className="text-lg font-semibold leading-snug mb-2 line-clamp-2">
                {videoInfo.title}
              </h2>
              <p className="text-text-secondary text-sm mb-3">
                {videoInfo.channel}
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-text-muted">
                <span className="inline-flex items-center gap-1 bg-bg-secondary rounded-lg px-2.5 py-1">
                  <ClockIcon />
                  {videoInfo.duration_string}
                </span>
                {videoInfo.view_count > 0 && (
                  <span className="inline-flex items-center gap-1 bg-bg-secondary rounded-lg px-2.5 py-1">
                    <EyeIcon />
                    {formatNumber(videoInfo.view_count)} views
                  </span>
                )}
                {videoInfo.upload_date && (
                  <span className="inline-flex items-center gap-1 bg-bg-secondary rounded-lg px-2.5 py-1">
                    <CalendarIcon />
                    {formatDate(videoInfo.upload_date)}
                  </span>
                )}
                {videoInfo.audio_formats.length > 0 && (
                  <span className="inline-flex items-center gap-1 bg-bg-secondary rounded-lg px-2.5 py-1">
                    <AudioIcon />
                    {videoInfo.audio_formats.length} audio stream
                    {videoInfo.audio_formats.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Format selector */}
          <div className="border-t border-border p-5">
            <h3 className="text-sm font-semibold text-text-secondary mb-3">
              Output Format
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(videoInfo.output_formats || Object.keys(FORMAT_LABELS)).map(
                (fmt) => (
                  <FormatCard
                    key={fmt}
                    format={fmt}
                    selected={selectedFormat === fmt}
                    onClick={() => setSelectedFormat(fmt)}
                  />
                )
              )}
            </div>
          </div>

          {/* Download button */}
          <div className="border-t border-border p-5">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="
                w-full rounded-xl bg-accent hover:bg-accent-hover py-4
                font-semibold text-white text-lg transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2 cursor-pointer
                hover:shadow-[0_0_30px_rgba(124,58,237,0.3)]
              "
            >
              {downloading ? (
                <>
                  <Spinner />
                  Download Started — Check Your Browser
                </>
              ) : (
                <>
                  <DownloadIcon />
                  Download Audio
                </>
              )}
            </button>
            {downloading && (
              <p className="text-text-muted text-xs text-center mt-3">
                The server is extracting audio from YouTube. For long videos this
                may take several minutes — your browser will show the download
                once it begins streaming.
              </p>
            )}
          </div>
        </div>
      )}

      {/* SEO Content Section */}
      {!videoInfo && (
        <section className="w-full max-w-2xl mt-8 space-y-8">
          {/* How it works */}
          <div className="rounded-2xl border border-border bg-bg-card p-6">
            <h2 className="text-lg font-semibold mb-4 text-text-primary">
              How It Works
            </h2>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-accent font-semibold">1. Paste URL</div>
                <p className="text-text-muted">
                  Copy any YouTube video link and paste it above.
                </p>
              </div>
              <div className="space-y-1">
                <div className="text-accent font-semibold">2. Pick Format</div>
                <p className="text-text-muted">
                  Choose MP3, WAV, FLAC, AAC, OGG, Opus, or original quality.
                </p>
              </div>
              <div className="space-y-1">
                <div className="text-accent font-semibold">3. Download</div>
                <p className="text-text-muted">
                  Audio is extracted directly — no video conversion needed.
                </p>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="rounded-2xl border border-border bg-bg-card p-6">
            <h2 className="text-lg font-semibold mb-4 text-text-primary">
              Features
            </h2>
            <ul className="grid sm:grid-cols-2 gap-3 text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">&#10003;</span>
                <span>Direct audio stream extraction — no video downloaded</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">&#10003;</span>
                <span>8 output formats including lossless FLAC and WAV</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">&#10003;</span>
                <span>Handles long videos — 5+ hours, no problem</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">&#10003;</span>
                <span>Original quality option — zero re-encoding</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">&#10003;</span>
                <span>Free to use — no sign-up required</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">&#10003;</span>
                <span>High-quality MP3 encoding (best VBR setting)</span>
              </li>
            </ul>
          </div>

          {/* FAQ for SEO */}
          <div className="rounded-2xl border border-border bg-bg-card p-6">
            <h2 className="text-lg font-semibold mb-4 text-text-primary">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4 text-sm">
              <details className="group">
                <summary className="cursor-pointer font-medium text-text-primary hover:text-accent transition-colors">
                  What audio formats are supported?
                </summary>
                <p className="mt-2 text-text-muted pl-1">
                  MP3, WAV, FLAC, AAC, M4A, OGG (Vorbis), Opus, and the original
                  native stream from YouTube (typically Opus or AAC) with zero
                  re-encoding.
                </p>
              </details>
              <details className="group">
                <summary className="cursor-pointer font-medium text-text-primary hover:text-accent transition-colors">
                  Can I download audio from very long videos?
                </summary>
                <p className="mt-2 text-text-muted pl-1">
                  Yes. The server is configured with extended timeouts specifically
                  for long-duration content. Videos of 5+ hours work reliably.
                </p>
              </details>
              <details className="group">
                <summary className="cursor-pointer font-medium text-text-primary hover:text-accent transition-colors">
                  Is the audio quality preserved?
                </summary>
                <p className="mt-2 text-text-muted pl-1">
                  Audio is extracted directly from YouTube&apos;s audio-only DASH
                  stream — no video data is ever downloaded. Choose &ldquo;Original&rdquo;
                  format for zero re-encoding, or MP3/FLAC for the highest quality
                  conversion available.
                </p>
              </details>
              <details className="group">
                <summary className="cursor-pointer font-medium text-text-primary hover:text-accent transition-colors">
                  Is this tool free?
                </summary>
                <p className="mt-2 text-text-muted pl-1">
                  Yes, completely free with no account required.
                </p>
              </details>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-auto pt-12 pb-6 text-center text-text-muted text-xs">
        <p>
          Audio is extracted directly from YouTube&apos;s audio streams — no
          video data is downloaded.
        </p>
      </footer>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG Icons
// ---------------------------------------------------------------------------

function ClockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
    </svg>
  );
}
