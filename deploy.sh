#!/bin/bash
# SmartSchool Production Deployment Script
# Run this from the project root directory

echo "🚀 Starting SmartSchool production deployment..."

# Build frontend
echo "📦 Building frontend..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed"
    exit 1
fi

# Build backend
echo "📦 Building backend..."
cd backend
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Backend build failed"
    exit 1
fi
cd ..

# Deploy with Docker Compose
echo "🐳 Starting production containers..."
docker compose -f docker-compose.production.yaml up --build -d

echo "✅ Deployment complete!"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:4000"
echo ""
echo "To check logs: docker compose -f docker-compose.production.yaml logs -f"
echo "To stop: docker compose -f docker-compose.production.yaml down"