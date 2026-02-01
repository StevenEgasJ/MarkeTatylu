FROM node:18-alpine
WORKDIR /app
# Copy package files from service directory to ensure correct package.json is used
COPY services/backend-crud/package*.json ./
RUN npm install --production
# Copy the service source
COPY services/backend-crud/ ./
EXPOSE 3001
CMD ["npm", "start"]
