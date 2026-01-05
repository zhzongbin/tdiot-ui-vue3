#!/bin/bash
# Function to cleanup background processes on exit
cleanup() {
    echo "Stopping servers..."
    kill $(jobs -p)
}
trap cleanup EXIT

echo "Starting NestJS Server..."
cd server
# 生产环境运行
node dist/main.js &
cd ..

echo "Starting Frontend..."
npm run dev
