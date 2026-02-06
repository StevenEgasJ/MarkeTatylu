FROM node:18-alpine
# Copy entire repository so local file: dependencies resolve correctly
COPY . /app
WORKDIR /app/services/backend-crud
# Install only production dependencies for the service
RUN npm install --production
EXPOSE 3001
CMD ["npm", "start"]
