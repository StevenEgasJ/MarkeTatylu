FROM nginx:stable-alpine

# Install envsubst (comes with gettext package)
RUN apk add --no-cache gettext

# Copy nginx config template (will be processed at runtime with env vars)
COPY services/frontend/nginx.conf.template /etc/nginx/conf.d/default.conf.template

# For local Docker Compose, also provide a static config with internal hostnames
COPY services/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy service-local frontend assets (static HTML + JS)
COPY ./services/frontend/public /usr/share/nginx/html

# Copy custom entrypoint script
COPY services/frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

# Default backend URLs (will be overridden by environment variables on Render)
ENV BACKEND_CRUD_URL=http://backend-crud:3001
ENV BACKEND_BUSINESS_URL=http://backend-business:3002

# Use custom entrypoint that processes template
ENTRYPOINT ["/docker-entrypoint.sh"]
