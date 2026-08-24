#!/bin/bash

# Upload cookies to the backend API
# Usage: ./upload_cookies.sh /path/to/cookies.txt

COOKIES_FILE="$1"
API_URL="https://yt-audio-api-1055001435382.us-central1.run.app/api/cookies"

if [ -z "$COOKIES_FILE" ]; then
    echo "Usage: ./upload_cookies.sh /path/to/cookies.txt"
    exit 1
fi

if [ ! -f "$COOKIES_FILE" ]; then
    echo "Error: File not found: $COOKIES_FILE"
    exit 1
fi

echo "Uploading cookies to $API_URL..."
curl -X POST "$API_URL" \
  -H "Content-Type: text/plain" \
  --data-binary "@$COOKIES_FILE"

echo -e "\n\nChecking health status..."
curl -s "$API_URL/../health" | python3 -m json.tool
