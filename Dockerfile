FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
COPY config ./config

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

EXPOSE 3001
CMD ["node", "server/index.js"]
