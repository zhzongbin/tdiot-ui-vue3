#!/bin/bash

# 确保脚本发生错误时停止
set -e

echo "🔧 [1/5] 安装/更新依赖..."
# 如果没有 pnpm，先安装
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
fi
pnpm install
cd server && pnpm install
cd ..

echo "🗄️ [2/5] 初始化数据库 (Prisma)..."
cd server
# 生成 Prisma Client
npx prisma generate
# 执行数据库迁移 (如果 dev.db 不存在会自动创建)
npx prisma migrate deploy
cd ..

echo "🏗️ [3/5] 构建 NestJS 后端..."
cd server
pnpm build
cd ..

echo "🚀 [4/5] 启动服务..."
echo "正在后台启动 NestJS 后端 (Port 3000)..."
# 使用 nohup 后台运行后端，日志输出到 backend.log
nohup node server/dist/main.js > backend.log 2>&1 &
BACKEND_PID=$!
echo "后端 PID: $BACKEND_PID"

echo "正在启动 Vue 前端 (开发模式)..."
# 注意：前端开发服务器默认运行在前台
npm run dev

# 退出时清理后台进程
cleanup() {
    echo "正在关闭后端服务 (PID: $BACKEND_PID)..."
    kill $BACKEND_PID
}
trap cleanup EXIT
