FROM node:18-alpine
WORKDIR /app
# Copy only the service package files so we don't pick the repo root package.json
COPY services/backend-crud/package*.json ./
RUN npm install --production
# Copy the service source only
COPY services/backend-crud/ ./
EXPOSE 3001
CMD ["npm", "start"]
