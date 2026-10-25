FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
# Explicit font files prevent invisible Canvas text in minimal Linux images.
# gosu lets the entrypoint fix Railway Volume ownership and then drop root privileges.
RUN apt-get update \
  && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core gosu \
  && fc-cache -f \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
# Fail the Railway build if project syntax, configuration, commands or Canvas text rendering break.
RUN npm run check
RUN npm test
RUN mkdir -p /app/data && chown -R node:node /app
CMD ["sh", "scripts/start-docker.sh"]
