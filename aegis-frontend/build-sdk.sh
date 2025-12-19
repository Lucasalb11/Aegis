#!/bin/bash
set -e  # Exit on any error

echo "🔨 Building SDK..."
cd ../aegis-protocol

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "📦 Installing SDK dependencies..."
  yarn install --frozen-lockfile || yarn install
fi

# Build the SDK
echo "🏗️  Building SDK..."
yarn workspace @aegis/sdk run build

echo "✅ SDK built successfully!"
