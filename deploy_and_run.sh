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
# 生成 Prisma Client (使用 pnpm 以确保使用项目本地版本)
pnpm prisma generate
# 执行数据库迁移 (如果 dev.db 不存在会自动创建)
pnpm prisma migrate deploy
cd ..

echo "🏗️ [3/5] 构建 NestJS 后端..."
cd server
pnpm build
cd ..

echo "🚀 [4/5] 启动服务 (后台模式)..."

# 启动 NestJS 后端
echo "正在启动 NestJS 后端 (Port 3000)..."
nohup node server/dist/main.js > backend.log 2>&1 &
BACKEND_PID=$!
echo "后端已启动 (PID: $BACKEND_PID), 日志: backend.log"

# 启动 Vue 前端
echo "正在启动 Vue 前端 (开发模式)..."
nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "前端已启动 (PID: $FRONTEND_PID), 日志: frontend.log"

echo "------------------------------------------------"
echo "✅ 部署完成！"
echo "你可以通过 'tail -f backend.log' 或 'tail -f frontend.log' 查看实时日志。"
echo "即使退出 SSH，程序也会继续运行。"
echo "若要手动停止，请执行: kill $BACKEND_PID $FRONTEND_PID"
echo "------------------------------------------------"
