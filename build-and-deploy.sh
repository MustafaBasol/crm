#!/bin/bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PUBLIC_DIR="$ROOT_DIR/backend/public"

echo "🏗️  Building frontend..."
cd "$ROOT_DIR"
npm run build

echo "📦 Copying build to backend..."
# Copy hashed assets to backend/public/assets and update index.html
rm -rf "$BACKEND_PUBLIC_DIR/assets"
mkdir -p "$BACKEND_PUBLIC_DIR/assets"
cp -r "$ROOT_DIR/dist/assets/"* "$BACKEND_PUBLIC_DIR/assets/"
cp "$ROOT_DIR/dist/index.html" "$BACKEND_PUBLIC_DIR/index.html"

echo "✅ Build complete! Frontend is now served by backend at http://localhost:3001"
echo "📚 API documentation available at: http://localhost:3002/api"
