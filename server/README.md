# Server for El Valle (MongoDB + Express)
# Server for El Valle (MongoDB + Express)

This folder contains a minimal Express server using Mongoose to connect to MongoDB (Atlas or local). It's a scaffold to migrate client-side localStorage persistence to a proper database and prepare the app for cloud deployment.

Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI` and `JWT_SECRET`.

2. Install dependencies (run in PowerShell from `server/`):

```powershell
npm install
```

3. Start the server:

```powershell
npm run start
```

API (basic)

- GET /api/products
- GET /api/products/:id
- POST /api/products
- POST /api/auth/register
- POST /api/auth/login
- GET /api/cart (requires Authorization: Bearer <token>)
- POST /api/cart (requires Authorization)

Next steps

- Add robust validation and admin-protected routes.
- Replace frontend localStorage calls with fetch() to these endpoints.
- Add tests and CI.

MongoDB Atlas and cloud deployment

1) Create a MongoDB Atlas cluster
	- Go to https://www.mongodb.com/cloud/atlas and create a free cluster.
	- Create a database user (set a username and a strong password) and copy the credentials.
	- Whitelist the IP address of your deployment (for testing you can allow your current IP and 0.0.0.0/0 for quick testing — do not leave 0.0.0.0/0 in production).
	- Get the connection string (it looks like: `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/el-valle?retryWrites=true&w=majority`).

2) Configure the server
	- Copy `.env.example` to `.env` inside the `server/` folder and set `MONGODB_URI` to the Atlas connection string.
	- Set `JWT_SECRET` to a secure random string.
	- Optionally set `ALLOWED_ORIGINS` to a comma separated list of origins (e.g., `https://myfrontend.example.com,http://localhost:5173`) so CORS is restricted in production.

3) Run locally

```powershell
cd c:\PROGRAMACION-WEB\Proyecto\server
npm install
npm run start
```

4) Deploying the backend (recommended options)

- Render (https://render.com): create a new Web Service, connect the repo, set the build command `npm install` and start command `npm run start`. Add `MONGODB_URI` and `JWT_SECRET` as environment variables in the service settings. Render exposes a public URL which your frontend will call.

- Railway / Fly / Fly.io: similar flow — set environment variables in the dashboard and deploy from GitHub.

- Docker: build and push the image to a registry (Docker Hub, GitHub Container Registry) and deploy to a container host. A `Dockerfile` is included in this folder.

5) Serving the frontend

- Option A (static hosting): keep the frontend static files in the repo and use GitHub Pages, Netlify or Vercel to serve them. Configure the frontend to call your backend's production URL (set via env at build time or by using a small runtime config fetched on load).

- Option B (single host): deploy the Node server and let it serve static files (current server does this). For scaling and security it's common to host frontend separately and point the frontend to the backend service URL.

6) CI & secrets

- Add `MONGODB_URI` and `JWT_SECRET` as protected environment variables in your deployment platform and CI pipeline. Avoid committing secrets.

7) Production notes

- Use HTTPS on your frontend and backend in production.
- Do not allow `0.0.0.0/0` in Atlas production whitelist; prefer using the provider's networking integration (VPC peering) or specific IP ranges.
- Consider storing user photos in a dedicated object storage (S3, Cloudinary) instead of as base64 in DB.

If you want, I can continue by updating the frontend to call the new API (I recommend starting with `productManager.js` to fetch products, then migrate cart to use `/api/cart`).
