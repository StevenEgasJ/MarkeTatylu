FROM node:18-alpine
WORKDIR /app
# Copy package files (relative to service build context)
COPY package*.json ./
RUN npm install --production
# Copy the service source
COPY . ./
EXPOSE 3002
CMD ["npm", "start"]
