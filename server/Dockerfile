FROM node:18-alpine

WORKDIR /app

# Copy server files
COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

ENV NODE_ENV=production

EXPOSE 4000

CMD ["node", "server.js"]
