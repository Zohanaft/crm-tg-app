FROM node:24-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

COPY . .

# Prepare Nuxt
RUN npx nuxt prepare

# Dev server: 0.0.0.0 for Docker, port 3001
CMD ["sh", "-c", "npx nuxt dev --dotenv .env.dev"]
