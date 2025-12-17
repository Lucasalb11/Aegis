#!/bin/bash

# Aegis Protocol - Deploy to Devnet Script
# Usage: ./scripts/deploy-devnet.sh

set -e

echo "🚀 Starting Aegis Protocol Devnet Deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROGRAM_NAME="aegis_protocol"
PROGRAM_ID="AerttabNDRDQkaHZBKka1JFGytct6Bx5hV5Jonrvwryu"
CLUSTER="devnet"
WALLET_PATH="$HOME/.config/solana/id.json"

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if Solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo -e "${RED}❌ Solana CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check if Anchor CLI is installed
if ! command -v anchor &> /dev/null; then
    echo -e "${RED}❌ Anchor CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check if wallet exists
if [ ! -f "$WALLET_PATH" ]; then
    echo -e "${RED}❌ Wallet not found at $WALLET_PATH${NC}"
    echo -e "${YELLOW}💡 Run: solana-keygen new --outfile $WALLET_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Set Solana configuration
echo "🔧 Configuring Solana for devnet..."
solana config set --url https://api.devnet.solana.com --keypair "$WALLET_PATH"

# Check wallet balance
echo "💰 Checking wallet balance..."
BALANCE=$(solana balance | awk '{print $1}')
if (( $(echo "$BALANCE < 1.0" | bc -l) )); then
    echo -e "${YELLOW}⚠️  Low balance: $BALANCE SOL${NC}"
    echo -e "${YELLOW}💡 Requesting airdrop...${NC}"
    solana airdrop 2
fi

# Navigate to program directory
cd program

# Clean previous builds
echo "🧹 Cleaning previous builds..."
anchor clean

# Build the program
echo "🔨 Building program..."
anchor build

# Check if build was successful
if [ ! -f "target/deploy/${PROGRAM_NAME}.so" ]; then
    echo -e "${RED}❌ Build failed - binary not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Deploy the program
echo "📦 Deploying to devnet..."
anchor deploy --provider.cluster "$CLUSTER"

# Verify deployment
echo "🔍 Verifying deployment..."
sleep 5

if solana program show "$PROGRAM_ID" &> /dev/null; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo -e "${GREEN}📍 Program ID: $PROGRAM_ID${NC}"
    echo -e "${GREEN}🌐 Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=$CLUSTER${NC}"
else
    echo -e "${RED}❌ Deployment verification failed${NC}"
    exit 1
fi

# Run tests
echo "🧪 Running tests..."
if anchor test --skip-deploy; then
    echo -e "${GREEN}✅ Tests passed${NC}"
else
    echo -e "${YELLOW}⚠️  Some tests failed - check output above${NC}"
fi

# Build SDK
echo "📦 Building SDK..."
cd ../sdk
npm install
npm run build

echo -e "${GREEN}✅ SDK built successfully${NC}"

# Build frontend
echo "🌐 Building frontend..."
cd ../app
npm install
npm run build

echo -e "${GREEN}✅ Frontend built successfully${NC}"

# Final summary
echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo ""
echo "📋 Summary:"
echo "  • Program ID: $PROGRAM_ID"
echo "  • Cluster: $CLUSTER"
echo "  • Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=$CLUSTER"
echo "  • SDK: Built and ready"
echo "  • Frontend: Built and ready"
echo ""
echo "🚀 Next steps:"
echo "  1. Start frontend: cd app && npm run dev"
echo "  2. Test the application"
echo "  3. Monitor program logs: solana logs $PROGRAM_ID"
echo ""

exit 0




