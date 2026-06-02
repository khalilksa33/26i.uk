#!/bin/bash
# UmrahGo Full Automation Deployment Script
# Supports: Install, Update, Upgrade, and Service Management

set -e

APP_NAME="umrahgo"
APP_DIR=$(pwd)
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"

echo "🚀 UmrahGo Deployment Manager"

# 1. Environment Check
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "❗ PLEASE EDIT .env WITH YOUR SECRETS BEFORE STARTING."
fi

# 2. Update Source (if inside a git repo)
if [ -d .git ]; then
    echo "📥 Checking for updates..."
    git pull origin master
else
    echo "ℹ️  Not a git repository, skipping update check."
fi

# 3. Install/Sync Dependencies
echo "📦 Installing/Updating dependencies..."
npm install

# 4. Clean and Build
echo "🏗️  Building production assets (Vite + Server Bundle)..."
npm run clean
npm run build

# 5. Service Management
if [ -f "$SERVICE_FILE" ]; then
    echo "🔄 Restarting ${APP_NAME} service..."
    sudo systemctl restart $APP_NAME
    echo "✅ Service restarted."
else
    echo "💡 Systemd service not found."
    echo "   To install as a service, run:"
    echo "   sudo cp umrahgo.service.example $SERVICE_FILE"
    echo "   sudo systemctl daemon-reload"
    echo "   sudo systemctl enable $APP_NAME"
    echo "   sudo systemctl start $APP_NAME"
fi

echo "✨ Deployment/Upgrade Successful!"
