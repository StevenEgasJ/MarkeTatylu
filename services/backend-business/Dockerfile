FROM node:18-alpine
WORKDIR /app
# Copy only the service package files so we don't pick the repo root package.json
COPY services/backend-business/package*.json ./
RUN npm install --production
# Copy the service source only
COPY services/backend-business/ ./
EXPOSE 3002
CMD ["npm", "start"]
