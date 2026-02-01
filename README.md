# MarketTatylu (Monorepo Services)

This repo has been scaffolded so the app runs as three services:

- Frontend (static served by Nginx) — `services/frontend/Dockerfile`
- Backend CRUD API (Express) — `services/backend-crud`
- Backend Business API (Express) — `services/backend-business`

Local dev:
- docker compose up --build

Deploy to Render:
- Use the provided `render.yaml` or create three Web Services in Render and point their Dockerfile paths to the files in `services/`.

