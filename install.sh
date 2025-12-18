#!/bin/bash
set -e  # Exit on any error

echo "🚀 Starting installation process..."

# Build SDK first
echo "📦 Installing and building SDK..."
cd aegis-protocol/sdk
pnpm install || npm install -g pnpm && pnpm install
pnpm run build

# Verify SDK was built
if [ ! -d "dist" ]; then
  echo "❌ SDK build failed - dist directory not found"
  exit 1
fi

echo "✅ SDK built successfully"

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../../aegis-frontend
pnpm install

echo "✅ Installation completed successfully!"
