# Built from deploy/, so the launcher and the brain template land in one image.
FROM node:22-alpine
RUN apk add --no-cache docker-cli docker-cli-compose
WORKDIR /app
COPY launcher/package.json launcher/package-lock.json ./
RUN npm ci --omit=dev
COPY launcher/ ./
COPY templates/ ./templates/
ENV BRAIN_TEMPLATE=/app/templates/brain.compose.yml
EXPOSE 9000
CMD ["node", "server.js"]
