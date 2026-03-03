FROM node:20-alpine AS base
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/

RUN npm install

COPY . .
RUN npm run build -w @projectm/contracts && npm run build -w @projectm/api

EXPOSE 4000
CMD ["node", "apps/api/dist/src/server.js"]
