#!/bin/bash
set -e  # Exit on any error

echo "🔨 Building SDK..."
cd ../aegis-protocol/sdk

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "📦 Installing SDK dependencies..."
  pnpm install
fi

# Build the SDK
echo "🏗️  Building SDK..."
pnpm run build

echo "✅ SDK built successfully!"
