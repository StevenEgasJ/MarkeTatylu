# Services

This folder contains three independent services:

- `services/frontend` — static site served via Nginx (Dockerfile copies `services/frontend/public` into the image)
- `services/backend-crud` — Express app exposing resource CRUD endpoints (example routes in `index.js`)
- `services/backend-business` — Express app for business workflows (checkout example in `index.js`)

Each service is containerized and can be deployed independently (Render, Docker Compose, Kubernetes, etc.).
