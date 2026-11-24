# Built from the repo root: docker build -f apps/api/Dockerfile .
FROM node:24-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
RUN pnpm install --frozen-lockfile --prod --filter api...
COPY packages/shared packages/shared
COPY apps/api apps/api
WORKDIR /app/apps/api
ENV NODE_ENV=production
# Node 24 runs the TypeScript directly (type stripping); no build step.
CMD ["node", "src/main.ts"]
