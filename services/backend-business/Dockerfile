FROM node:18-alpine
WORKDIR /app
# Copy package files from service directory to ensure correct package.json is used
COPY services/backend-business/package*.json ./
RUN npm install --production
# Copy the service source
COPY services/backend-business/ ./
EXPOSE 3002
CMD ["npm", "start"]
