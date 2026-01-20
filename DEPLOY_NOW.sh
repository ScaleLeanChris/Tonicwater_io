#!/bin/bash

# TonicWater.io - Quick Deployment Script
# This script will guide you through deploying your project to Cloudflare Pages

set -e

echo "🍸 TonicWater.io - Deployment Script"
echo "===================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "📦 Installing Wrangler CLI..."
    npm install -g wrangler
fi

# Check authentication
echo "🔐 Checking Cloudflare authentication..."
if ! npx wrangler whoami &> /dev/null; then
    echo "❌ Not authenticated with Cloudflare"
    echo "🌐 Opening browser for authentication..."
    npx wrangler login
else
    echo "✅ Already authenticated with Cloudflare"
fi

# Check if project exists
echo ""
echo "📋 Checking if Cloudflare Pages project exists..."
PROJECT_NAME="tonicwater-io"

# Try to get project info
if npx wrangler pages project list 2>&1 | grep -q "$PROJECT_NAME"; then
    echo "✅ Project '$PROJECT_NAME' already exists"
else
    echo "📝 Creating Cloudflare Pages project..."
    npx wrangler pages project create "$PROJECT_NAME" --production-branch=main
fi

# Build the project (if needed)
echo ""
echo "🔨 Preparing files for deployment..."
# No build step needed - static files are ready in public/

# Deploy
echo ""
echo "🚀 Deploying to Cloudflare Pages..."
npx wrangler pages deploy public --project-name="$PROJECT_NAME" --branch=main

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your site should be live at:"
echo "   https://$PROJECT_NAME.pages.dev"
echo ""
echo "📊 View deployment details:"
echo "   https://dash.cloudflare.com"
echo ""
echo "🎉 Cheers! Your TonicWater.io is now live!"
