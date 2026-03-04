FROM node:22-bookworm-slim
WORKDIR /opt/app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337

RUN npm run build

EXPOSE 1337
CMD ["npm", "run", "start"]

