FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
COPY tsconfig.json ./
RUN pnpm build
FROM nginx:alpine
COPY --from=build /app/dist/web /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
