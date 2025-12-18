#!/bin/bash

# Gatekeeper Database Setup Script
# This script sets up the PostgreSQL database using Docker

set -e

echo "🚀 Setting up Gatekeeper database..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start PostgreSQL and Redis containers
echo "📦 Starting Docker containers..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker-compose exec postgres pg_isready -U gatekeeper_user -d gatekeeper; do
    sleep 2
done

echo "✅ PostgreSQL is ready!"

# Generate Prisma client
echo "🔧 Generating Prisma client..."
pnpm db:generate

# Push database schema
echo "�� Pushing database schema..."
pnpm db:push

# Optional: Run seed
read -p "🌱 Do you want to run the database seed? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌱 Running database seed..."
    pnpm db:seed
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update your .env file with your Clerk credentials"
echo "2. Start the development server: pnpm dev"
echo "3. Visit http://localhost:3000"
echo ""
echo "🔧 Useful commands:"
echo "- View database: pnpm db:studio"
echo "- View logs: pnpm docker:logs"
echo "- Stop containers: pnpm docker:down"