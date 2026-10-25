FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
# Canvas renders no text in many slim containers without an installed fontconfig/font family.
# Install DejaVu system fonts and make the family visible to @napi-rs/canvas.
RUN apt-get update \
  && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core \
  && fc-cache -f \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
RUN mkdir -p /app/data
# Railway volumes can be mounted root-owned; keeping the runtime user root avoids SQLite EACCES.
USER root
CMD ["sh", "scripts/start-docker.sh"]
