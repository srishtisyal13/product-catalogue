# Build context is the repository root (see docker-compose.yml).
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies first so this layer is cached between code changes.
COPY package.json package-lock.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY packages/shared/src packages/shared/src
COPY apps/api/src apps/api/src

# Node runs the TypeScript directly (built-in type stripping), so there is no build step.
USER node
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "src/server.ts"]
