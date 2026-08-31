"""
YouTube Audio Downloader - Backend API
Flask server using yt-dlp to extract audio-only streams from YouTube.
Designed for deployment on Google Cloud Run.
"""

import os
import re
import shutil
import tempfile
import logging
import json

from flask import Flask, request, jsonify, Response, send_file
from flask_cors import CORS
import yt_dlp

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

app = Flask(__name__)

# Allow configurable CORS origins (comma-separated) or default to all
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*")
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS.split(",")}})

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Path to optional cookies file for YouTube authentication
# Export from your browser using "Get cookies.txt" extension
# Place at /app/cookies.txt in the Docker container
COOKIES_FILE = os.environ.get("COOKIES_FILE", "/app/cookies.txt")

# Common yt-dlp options to avoid bot detection
def get_base_ydl_opts() -> dict:
    """Return base yt-dlp options with anti-bot-detection settings."""
    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "extractor_args": {
            "youtube": {
                "player_client": ["ios", "android", "web"],
                "player_skip": ["webpage", "configs"],
            }
        },
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        },
    }
    # Use cookies file if it exists
    if os.path.isfile(COOKIES_FILE):
        opts["cookiefile"] = COOKIES_FILE
        logger.info("Using cookies file: %s", COOKIES_FILE)
    return opts


SUPPORTED_FORMATS = {
    "mp3":      {"postprocessor": "mp3",    "content_type": "audio/mpeg"},
    "wav":      {"postprocessor": "wav",    "content_type": "audio/wav"},
    "flac":     {"postprocessor": "flac",   "content_type": "audio/flac"},
    "aac":      {"postprocessor": "aac",    "content_type": "audio/aac"},
    "m4a":      {"postprocessor": "m4a",    "content_type": "audio/mp4"},
    "ogg":      {"postprocessor": "vorbis", "content_type": "audio/ogg"},
    "opus":     {"postprocessor": "opus",   "content_type": "audio/opus"},
    "original": {"postprocessor": None,     "content_type": None},
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def sanitize_filename(name: str) -> str:
    """Remove characters that are unsafe for filenames."""
    return re.sub(r'[^\w\s\-.]', '', name).strip()


def format_duration(seconds: int) -> str:
    """Convert seconds to human-readable duration string."""
    if not seconds:
        return "Unknown"
    h, remainder = divmod(int(seconds), 3600)
    m, s = divmod(remainder, 60)
    if h > 0:
        return f"{h}h {m}m {s}s"
    return f"{m}m {s}s"

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint."""
    has_cookies = os.path.isfile(COOKIES_FILE)
    return jsonify({"status": "ok", "cookies_loaded": has_cookies})


@app.route("/api/cookies", methods=["POST"])
def upload_cookies():
    """
    Upload a Netscape-format cookies.txt file.
    Expects multipart form data with a 'file' field,
    or raw text body with the cookies content.
    """
    admin_key = os.environ.get("ADMIN_KEY", "")
    provided_key = request.headers.get("X-Admin-Key", "")
    if admin_key and provided_key != admin_key:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        if request.files and "file" in request.files:
            request.files["file"].save(COOKIES_FILE)
        elif request.data:
            with open(COOKIES_FILE, "wb") as f:
                f.write(request.data)
        else:
            return jsonify({"error": "No cookie data provided"}), 400

        logger.info("Cookies file uploaded successfully")
        return jsonify({"status": "ok", "message": "Cookies uploaded"})
    except Exception as e:
        logger.exception("Failed to upload cookies")
        return jsonify({"error": str(e)}), 500


@app.route("/api/info", methods=["GET"])
def get_info():
    """Return metadata for a YouTube video (no download)."""
    url = request.args.get("url", "").strip()
    if not url:
        return jsonify({"error": "Missing 'url' query parameter."}), 400

    try:
        ydl_opts = get_base_ydl_opts()
        ydl_opts["skip_download"] = True

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        # Collect audio-only streams
        audio_formats = []
        for f in info.get("formats") or []:
            acodec = f.get("acodec", "none")
            vcodec = f.get("vcodec", "none")
            if acodec != "none" and vcodec == "none":
                audio_formats.append({
                    "format_id": f.get("format_id"),
                    "ext": f.get("ext"),
                    "acodec": acodec,
                    "abr": f.get("abr"),          # audio bitrate (kbps)
                    "asr": f.get("asr"),          # audio sample rate
                    "filesize": f.get("filesize"),
                    "format_note": f.get("format_note", ""),
                })

        return jsonify({
            "title": info.get("title", "Unknown"),
            "duration": info.get("duration", 0),
            "duration_string": format_duration(info.get("duration")),
            "thumbnail": info.get("thumbnail", ""),
            "channel": info.get("channel") or info.get("uploader", "Unknown"),
            "view_count": info.get("view_count", 0),
            "upload_date": info.get("upload_date", ""),
            "audio_formats": sorted(audio_formats, key=lambda x: x.get("abr") or 0, reverse=True),
            "output_formats": list(SUPPORTED_FORMATS.keys()),
        })

    except yt_dlp.utils.DownloadError as e:
        logger.error("yt-dlp DownloadError: %s", e)
        return jsonify({"error": f"Could not fetch video info: {e}"}), 400
    except Exception as e:
        logger.exception("Unexpected error in /api/info")
        return jsonify({"error": str(e)}), 500


@app.route("/api/download", methods=["GET"])
def download():
    """
    Download the audio-only stream from a YouTube video and stream it
    back to the client.  Accepts `url` and `format` query params.
    """
    url = request.args.get("url", "").strip()
    fmt = request.args.get("format", "mp3").strip().lower()

    if not url:
        return jsonify({"error": "Missing 'url' query parameter."}), 400

    if fmt not in SUPPORTED_FORMATS:
        return jsonify({"error": f"Unsupported format '{fmt}'. Choose from: {list(SUPPORTED_FORMATS.keys())}"}), 400

    temp_dir = tempfile.mkdtemp()

    try:
        output_template = os.path.join(temp_dir, "%(title)s.%(ext)s")

        ydl_opts = get_base_ydl_opts()
        ydl_opts.update({
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "retries": 5,
            "fragment_retries": 5,
        })

        # Post-process to desired codec (skipped for "original")
        if fmt != "original":
            ydl_opts["postprocessors"] = [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": SUPPORTED_FORMATS[fmt]["postprocessor"],
                "preferredquality": "0",   # best quality
            }]

        logger.info("Starting download: url=%s format=%s", url, fmt)

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = sanitize_filename(info.get("title", "audio"))

        # Locate the output file
        files = os.listdir(temp_dir)
        if not files:
            return jsonify({"error": "Download failed — no file was produced."}), 500

        filepath = os.path.join(temp_dir, files[0])
        ext = os.path.splitext(files[0])[1]

        # Determine content type
        content_type = SUPPORTED_FORMATS[fmt]["content_type"]
        if content_type is None:
            _ct_map = {
                ".webm": "audio/webm",
                ".m4a": "audio/mp4",
                ".ogg": "audio/ogg",
                ".opus": "audio/opus",
            }
            content_type = _ct_map.get(ext, "application/octet-stream")

        filename = f"{title}{ext}"
        file_size = os.path.getsize(filepath)

        logger.info("Download complete: file=%s size=%d bytes", filename, file_size)

        def generate():
            try:
                with open(filepath, "rb") as f:
                    while True:
                        chunk = f.read(1024 * 1024)  # 1 MB chunks
                        if not chunk:
                            break
                        yield chunk
            finally:
                shutil.rmtree(temp_dir, ignore_errors=True)

        response = Response(generate(), content_type=content_type)
        response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
        response.headers["Content-Length"] = str(file_size)
        return response

    except yt_dlp.utils.DownloadError as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        logger.error("yt-dlp DownloadError: %s", e)
        return jsonify({"error": f"Download failed: {e}"}), 400
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        logger.exception("Unexpected error in /api/download")
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
