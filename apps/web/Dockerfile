FROM node:20-alpine AS build
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
RUN npm install

COPY . .
RUN npm run build -w @projectm/contracts && npm run build -w @projectm/web

FROM nginx:1.27-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
