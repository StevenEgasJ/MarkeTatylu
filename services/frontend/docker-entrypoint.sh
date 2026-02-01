#!/bin/sh
set -e

# Replace environment variables in nginx config template
envsubst '${BACKEND_CRUD_URL} ${BACKEND_BUSINESS_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

echo "✅ Nginx configured with:"
echo "   BACKEND_CRUD_URL=${BACKEND_CRUD_URL}"
echo "   BACKEND_BUSINESS_URL=${BACKEND_BUSINESS_URL}"

# Start nginx
exec nginx -g 'daemon off;'
