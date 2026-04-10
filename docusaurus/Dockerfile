# Stage 1: Builder
FROM node:20-alpine AS builder

# Set production environment for search plugin
ENV NODE_ENV=production

# Enable Corepack and activate pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependency files (cache layer)
COPY package.json pnpm-lock.yaml* ./

# Install dependencies with frozen lockfile
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod=false

# Copy source files and build
COPY . .
RUN pnpm run build

# Stage 2: Production
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
