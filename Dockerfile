# Multi-stage Dockerfile for ClueAI
# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for optimal Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source code and config files
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts postcss.config.js tailwind.config.js index.html ./
COPY public ./public
COPY src ./src

# Build production assets
RUN npm run build

# Stage 2: Production runtime stage with lightweight Nginx
FROM nginx:alpine AS runner

# Remove default nginx html files
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration for Single Page Application routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose standard web port
EXPOSE 80

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
