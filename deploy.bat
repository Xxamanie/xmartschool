@echo off
REM SmartSchool Production Deployment Script
REM Run this from the project root directory

echo 🚀 Starting SmartSchool production deployment...

REM Build frontend
echo 📦 Building frontend...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ❌ Frontend build failed
    exit /b 1
)

REM Build backend
echo 📦 Building backend...
cd backend
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ❌ Backend build failed
    exit /b 1
)
cd ..

REM Deploy with Docker Compose
echo 🐳 Starting production containers...
docker compose -f docker-compose.production.yaml up --build -d

echo ✅ Deployment complete!
echo.
echo 🌐 Frontend: http://localhost:3000
echo 🔧 Backend: http://localhost:4000
echo.
echo To check logs: docker compose -f docker-compose.production.yaml logs -f
echo To stop: docker compose -f docker-compose.production.yaml down
pause