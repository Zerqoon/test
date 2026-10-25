FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
RUN mkdir -p /app/data
# Railway mounts its persistent volume here; running as root avoids read-only volume ownership issues.
USER root
CMD ["sh", "scripts/start-docker.sh"]
