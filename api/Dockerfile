FROM node:22-bookworm-slim
WORKDIR /opt/app

COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337

RUN npm run build

EXPOSE 1337
CMD ["npm", "run", "start"]
