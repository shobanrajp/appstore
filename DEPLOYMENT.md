# Deployment to Vercel — StoreApp

This document explains how to deploy the three services to Vercel:
- Frontend (React app) — folder: `frontend`
- Backend (FastAPI) — folder: `backend`
- Image server (FastAPI static image server) — folder: `image_server`

Overview
--------
We recommend creating three separate Vercel projects (one per service) and configuring each project to use the correct root folder in the monorepo.

Frontend (recommended static deploy)
-----------------------------------
1. In Vercel, create a new project and point the root to the `frontend` folder.
2. Build command: `npm run build`
3. Output directory: `build`
4. Environment variables (in Vercel dashboard > Settings > Environment Variables):
   - `REACT_APP_IMAGE_SERVER_URL` - URL of the image server (e.g., `https://image-server.yourdomain.com`)
   - Any other REACT_APP_ prefixed environment variables required by your app

Notes: The repository already contains `frontend/vercel.json` which rewrites all routes to `index.html`.

Backend (FastAPI) — Dockerized
------------------------------
We add a `Dockerfile` and `vercel.json` in `backend/` to let Vercel build a container for your FastAPI app.

1. In Vercel dashboard, create a new project and set the root to `backend`.
2. Vercel will use `Dockerfile` to build the container.
3. Required environment variables (set in Vercel project environment):
   - `MONGO_URL` (e.g., `mongodb+srv://user:pass@cluster.mongodb.net`)
   - `DB_NAME` (the database name)
   - `JWT_SECRET` (strong secret used to sign JWT tokens)
   - (Optional) `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` if you use Razorpay
   - Any other envs your backend expects (see `backend/server.py` comments)

Image server (FastAPI) — Dockerized
-----------------------------------
This server serves static images under `/static/*`.

1. Create a new Vercel project and set the root to `image_server`.
2. Vercel will build a Docker image from the `image_server/Dockerfile`.
3. Environment variables you might set (optional):
   - `IMAGE_SERVER_BASE_URL` (if you want the server to construct absolute URLs for uploaded images; otherwise set `REACT_APP_IMAGE_SERVER_URL` in frontend to the public URL)

General steps (Vercel CLI)
--------------------------
Install Vercel CLI:

  npm i -g vercel

From repo root, to link and deploy each project you can:

1) Frontend
   cd frontend
   vercel --prod
   (follow prompts and set project name; in project settings, add required env vars)

2) Backend
   cd backend
   vercel --prod
   (Vercel will build the Dockerfile; set environment vars in project settings)

3) Image server
   cd image_server
   vercel --prod
   (set environment variables or base url)

DNS & Custom Domains
---------------------
- For custom domains, add them to each Vercel project and set up DNS records as Vercel recommends.
- You will need to update `REACT_APP_IMAGE_SERVER_URL` (frontend env) to point to the deployed image-server domain.

Secrets & Best Practices
-------------------------
- Store secrets in Vercel dashboard (Project > Settings > Environment Variables) — do NOT hardcode secrets.
- Use different values for development and production environments.

Troubleshooting
---------------
- If your backend cannot connect to MongoDB, double-check `MONGO_URL` and IP allowlist settings for your DB provider.
- If images return 404 after deployment, ensure `REACT_APP_IMAGE_SERVER_URL` points to the image server and that the image files persisted correctly (the simple image server stores files on the container file system; for production, consider using remote storage like S3).

Optional: Persisted image storage (recommended)
-----------------------------------------------
Right now the image server stores files on the container filesystem, which does not persist across container redeploys. For production, mount an external storage backend or modify the image server to upload/read from S3 or a durable object store.

---
If you'd like, I can also:
- Add a small script to upload any local images to an S3 bucket and modify the image server to read from S3.
- Create `vercel` project configs in the repo (monorepo `project` presets) to simplify one-click setup.

Would you like me to add the deployment checklist to the repo and the Dockerfiles (I already created Dockerfiles and vercel.json for backend and image_server)? If so I can also add example Vercel CLI commands and environment variable summary into `DEPLOYMENT.md` (done).

### GitHub Actions
I added a GitHub Actions workflow `.github/workflows/deploy-to-vercel.yml` that runs on `push` to `main` and sequentially deploys the frontend, backend, and image server.

Required repository secrets:
- `VERCEL_TOKEN` — Vercel personal token
- `VERCEL_ORG_ID` — Vercel organization ID
- `VERCEL_PROJECT_ID_FRONTEND` — Vercel project ID for frontend
- `VERCEL_PROJECT_ID_BACKEND` — Vercel project ID for backend
- `VERCEL_PROJECT_ID_IMAGE` — Vercel project ID for image server

If you want, I can add a preview-on-PR workflow and status checks next.