# frontend/Dockerfile

# Use official Node.js image as build environment
FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Install dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# Copy the rest of the frontend source
COPY frontend/. .

# Log the env var to verify it's available
RUN echo "Building with NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"

# Then build
RUN npm run build


# Build the Next.js app
RUN npm run build

# --------- Production Image ---------
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# Copy built app from builder stage
COPY --from=builder /app/.next .next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/postcss.config.mjs ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/package.json ./

# Expose the frontend port
EXPOSE 3000

# Start the Next.js app
CMD ["npx", "next", "start"]
