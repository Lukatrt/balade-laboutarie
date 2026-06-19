# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --include=dev
COPY frontend/ ./
RUN npx vite build

# Stage 2: Build the backend and serve
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port 3000 inside the container
EXPOSE 3000

# Start the server
WORKDIR /app/backend
CMD ["node", "server.js"]
