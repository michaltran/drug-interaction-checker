FROM node:20-alpine
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Backend
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install

COPY backend/ ./backend/

# Init database
RUN cd backend && node database/init.js

# Frontend
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

WORKDIR /app/backend
CMD ["node", "server.js"]
