# SignalHire 异步研究 worker —— 部署到 Insforge Compute (或任意 Docker 宿主)。
FROM node:22-slim

WORKDIR /app

# 先装依赖 (利用缓存)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# 再拷代码
COPY . .

# 常驻轮询进程
CMD ["node", "index.mjs"]
