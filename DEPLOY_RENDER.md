# Deploying MarketTatylu to Render

## Overview
This project is split into three services deployed on separate Render servers:
- `market-tatylu-frontend` — static site served by Nginx (proxies API calls to backends)
- `market-tatylu-backend-crud` — CRUD REST API (Express) for products, users, auth
- `market-tatylu-backend-business` — Business logic API (Express) for checkout, invoices, orders

## Architecture (Production on Render)
```
User Browser
     ↓
Frontend (Nginx on Render)
https://market-tatylu-frontend.onrender.com
     ↓
     ├─→ /api/products, /api/auth, /api/users
     │   → Backend CRUD: https://market-tatylu-backend-crud.onrender.com
     │
     └─→ /api/checkout, /api/invoices
         → Backend Business: https://market-tatylu-backend-business.onrender.com
```

The frontend nginx config uses environment variables to proxy API requests to the correct backend URLs.

## Deployment Steps

### Option 1: Using render.yaml (Recommended - Infrastructure as Code)
1. Push your code to GitHub
2. Go to https://dashboard.render.com
3. Click "New" → "Blueprint"
4. Connect your repo `StevenEgasJ/MarketTatylu`
5. Render will detect `render.yaml` and create all three services automatically
6. **Important**: Set the `MONGODB_URI` environment variable for both backend services in the Render dashboard (render.yaml has `sync: false` for this)
7. Wait for builds to complete (~5-10 minutes)

### Create services one-by-one (manual)
Create the backend services first, then create the frontend and point it at the backend URLs.

#### 1) Backend — `market-tatylu-backend-crud` (create first)
- Dashboard: **New → Web Service**
- Environment: **Docker**
- Repo: `github.com/StevenEgasJ/MarketTatylu`  Branch: `main`
- Dockerfile Path: `services/backend-crud/Dockerfile`
- Health Check Path: `/health`
- Environment variables (minimum):
  - `NODE_ENV=production`
  - `PORT=3001`
  - `MONGODB_URI=<your-mongodb-connection-string>`
  - `JWT_SECRET=<random-secret>`
  - `SESSION_SECRET=<random-secret>`
  - `CLIENT_URL=https://<your-frontend-url>`
- Create the service and wait for build to succeed. Note the public URL (example: `https://market-tatylu-backend-crud.onrender.com`).

#### 2) Backend — `market-tatylu-backend-business` (create second)
- New → **Web Service**
- Environment: **Docker**
- Dockerfile Path: `services/backend-business/Dockerfile`
- Health Check Path: `/health`
- Environment variables (minimum):
  - `NODE_ENV=production`
  - `PORT=3002`
  - `MONGODB_URI=<same-mongodb-connection-string-as-crud>`
  - `JWT_SECRET=<same-secret-as-backend-crud>`  (must match JWT between backends)
  - `CLIENT_URL=https://<your-frontend-url>`
  - `APP_BASE_URL=https://<your-frontend-url>`
- Create and wait for build to finish. Note the public URL (example: `https://market-tatylu-backend-business.onrender.com`).

#### 3) Frontend — two options
Option A — Docker (recommended if you want nginx proxying):
- New → **Web Service** → Environment: **Docker**
- Dockerfile Path: `services/frontend/Dockerfile`
- Health Check Path: `/`
- Environment variables:
  - `BACKEND_CRUD_URL=https://<your-backend-crud-url>`
  - `BACKEND_BUSINESS_URL=https://<your-backend-business-url>`
- Create and wait for build to finish.

Option B — Static Site (free, simpler)
- New → **Static Site** (no Docker)
- Publish directory: `services/frontend/public`
- This is free on Render and ideal for purely static HTML/JS sites.

---
**Checklist after creation**
- Confirm both backends respond: `https://<backend-url>/health` → should return JSON `{ status: 'ok' }`.
- Set the frontend `BACKEND_CRUD_URL` and `BACKEND_BUSINESS_URL` correctly if using Docker frontend.
- Ensure `MONGODB_URI` is set and reachable from both backends.
- If using emails, add SMTP env vars to `market-tatylu-backend-business` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).

If you want, I can generate a short copy-paste checklist for each Render service form (values pre-filled) to speed up creation.

## Local Testing

### Local Docker Compose (simulates three separate servers)
```bash
docker compose up --build -d
```

Visit:
- Frontend: http://localhost:3000
- Backend CRUD: http://localhost:3001/health
- Backend Business: http://localhost:3002/health

The local setup uses internal Docker hostnames (`backend-crud:3001`, `backend-business:3002`) which get replaced with actual Render URLs in production via environment variables.

### Test the deployed stack
1. Visit your frontend URL: `https://market-tatylu-frontend.onrender.com`
2. Browse products (fetched from backend-crud via frontend proxy)
3. Register/login
4. Add products to cart
5. Complete checkout (handled by backend-business)
6. Check invoice email (if SMTP configured)

## Database Setup
- **Option 1**: MongoDB Atlas (free tier M0)
  - Create cluster at https://cloud.mongodb.com
  - Get connection string
  - Add to `MONGODB_URI` in both backend services
  
- **Option 2**: Render Managed PostgreSQL + MongoDB alternative
  - Or use Render's managed database if MongoDB is available

## Environment Variables Reference

### Frontend
- `BACKEND_CRUD_URL` - Full URL to backend-crud service (e.g., `https://market-tatylu-backend-crud.onrender.com`)
- `BACKEND_BUSINESS_URL` - Full URL to backend-business service (e.g., `https://market-tatylu-backend-business.onrender.com`)

### Backend CRUD & Business (both need these)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT token signing (must be same for both backends)
- `NODE_ENV=production`
- `CLIENT_URL` - Frontend URL for CORS

### Optional (Email functionality)
- `SMTP_HOST` - SMTP server (e.g., smtp.gmail.com)
- `SMTP_PORT` - Usually 587 for TLS
- `SMTP_USER` - Email account
- `SMTP_PASS` - Email password or app-specific password

## Notes
- Free tier services on Render spin down after 15 minutes of inactivity (first request will be slow)
- Upgrade to paid plans for always-on services and better performance
- The frontend nginx dynamically configures backend URLs at container startup using environment variables
- All three services share the same MongoDB database

