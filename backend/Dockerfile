# -----------------------------------------------------------
# YouTube Audio Downloader — Backend
# Runs on Google Cloud Run
# -----------------------------------------------------------
FROM python:3.12-slim

# Install ffmpeg (required for audio format conversion)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Cloud Run injects the PORT env var (default 8080)
ENV PORT=8080

# Use gunicorn for production with generous timeout for long downloads
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "3600", "--workers", "2", "--threads", "4", "app:app"]
