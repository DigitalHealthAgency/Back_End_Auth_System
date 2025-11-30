# =============================================================================
# Multi-Stage Dockerfile for Auth System Service
# Production-ready containerization following industry best practices
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies (Builder)
# Purpose: Install dependencies in a separate layer for better caching
# -----------------------------------------------------------------------------
FROM node:20-alpine AS dependencies

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production --ignore-scripts && \
    npm cache clean --force

# -----------------------------------------------------------------------------
# Stage 2: Production Runtime
# Purpose: Minimal production image with only necessary files
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Add labels for metadata (OCI standard)
LABEL maintainer="Elano <admin@elano.cloud>"
LABEL org.opencontainers.image.title="Auth System Service"
LABEL org.opencontainers.image.description="Authentication and authorization management system"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Elano"

# Install security updates and dumb-init
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy production dependencies from dependencies stage
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application source
COPY --chown=nodejs:nodejs . .

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/uploads /app/temp && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (matches your service PORT)
EXPOSE 5000

# Environment variables (defaults, override via env file or k8s)
ENV NODE_ENV=production \
    PORT=5000 \
    HOST=0.0.0.0 \
    LOG_LEVEL=info

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/server.js"]
