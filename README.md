# YouTube Audio Downloader

🔗 **Live Site:** [ytaudio-dl.vercel.app](https://ytaudio-dl.vercel.app)

A web app that extracts high-quality audio directly from YouTube videos. Supports long content (5+ hours), multiple output formats, and lossless quality options.

**Architecture:** Next.js frontend (Vercel) + Python/Flask backend with yt-dlp (Google Cloud Run).

---

## How It Works

1. User pastes a YouTube URL → frontend fetches video metadata from the backend
2. User picks an output format (MP3, WAV, FLAC, AAC, M4A, OGG, Opus, or Original)
3. Backend uses **yt-dlp** to download the **audio-only DASH stream** directly from YouTube (no video data is ever downloaded)
4. If a specific format is requested, **ffmpeg** converts the audio stream; "Original" serves the native stream untouched
5. The file is streamed back to the user's browser as a download

---

## Project Structure

```
├── backend/             # Python Flask API (deployed to Cloud Run)
│   ├── app.py           # API server
│   ├── requirements.txt # Python dependencies
│   └── Dockerfile       # Container image for Cloud Run
├── frontend/            # Next.js app (deployed to Vercel)
│   ├── app/
│   │   ├── page.tsx     # Main UI
│   │   ├── layout.tsx   # Root layout
│   │   └── globals.css  # Tailwind + custom styles
│   ├── package.json
│   └── .env.local       # NEXT_PUBLIC_API_URL
└── README.md
```

---

## Local Development

### Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **ffmpeg** installed (`brew install ffmpeg` on macOS)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

The API runs on `http://localhost:8080`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The UI runs on `http://localhost:3000` and talks to the backend at the URL in `.env.local`.

---

## Deployment

### Backend → Google Cloud Run

1. **Install the gcloud CLI** if you haven't: https://cloud.google.com/sdk/docs/install

2. **Authenticate and set your project:**

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

3. **Build and deploy:**

```bash
cd backend

# Build the container image using Cloud Build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/yt-audio-api

# Deploy to Cloud Run
gcloud run deploy yt-audio-api \
  --image gcr.io/YOUR_PROJECT_ID/yt-audio-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --timeout 3600 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 5 \
  --set-env-vars "ALLOWED_ORIGINS=https://your-app.vercel.app"
```

Note the deployed URL (e.g., `https://yt-audio-api-xxxxx-uc.a.run.app`).

Key flags:
- `--timeout 3600` — 60-minute request timeout for long videos
- `--memory 2Gi` — enough RAM for large audio files
- `--cpu 2` — faster ffmpeg encoding

### Frontend → Vercel

1. **Push the repo to GitHub**

2. **Import in Vercel:**
   - Go to https://vercel.com/new
   - Import your GitHub repo
   - Set the **Root Directory** to `frontend`
   - Add the environment variable:
     - `NEXT_PUBLIC_API_URL` = your Cloud Run URL (e.g., `https://yt-audio-api-xxxxx-uc.a.run.app`)

3. **Deploy** — Vercel handles the rest.

---

## API Endpoints

| Method | Path              | Description                        |
|--------|-------------------|------------------------------------|
| GET    | `/api/health`     | Health check                       |
| GET    | `/api/info?url=`  | Fetch video metadata (no download) |
| GET    | `/api/download?url=&format=` | Download audio and stream to client |

### Supported Formats

| Format   | Description                    |
|----------|--------------------------------|
| mp3      | Universal compatibility        |
| wav      | Uncompressed lossless          |
| flac     | Compressed lossless            |
| aac      | High efficiency                |
| m4a      | Apple / iTunes                 |
| ogg      | Open source (Vorbis)           |
| opus     | Modern & efficient             |
| original | Native YouTube stream, no re-encode |

---

## Environment Variables

### Frontend (`.env.local`)

| Variable              | Description           | Example                                        |
|-----------------------|-----------------------|------------------------------------------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL  | `https://yt-audio-api-xxxxx-uc.a.run.app`     |

### Backend

| Variable          | Description                              | Default |
|-------------------|------------------------------------------|---------|
| `PORT`            | Server port                              | `8080`  |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins             | `*`     |
