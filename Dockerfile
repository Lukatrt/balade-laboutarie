FROM node:20-alpine
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy backend source
COPY backend/ ./backend/

# Copy pre-built frontend
COPY frontend/dist/ ./frontend/dist/

# Expose port 3000 inside the container
EXPOSE 3000

# Start the server
WORKDIR /app/backend
CMD ["node", "server.js"]
