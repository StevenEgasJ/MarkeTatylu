FROM node:18-alpine
# Copy only required manifests to keep build lean
WORKDIR /app
COPY package*.json ./
COPY services/backend-business/package*.json ./services/backend-business/

WORKDIR /app/services/backend-business
RUN npm install --production

# Copy service source code
COPY services/backend-business ./

EXPOSE 3002
CMD ["npm", "start"]
