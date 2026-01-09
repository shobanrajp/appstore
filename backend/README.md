Backend on Vercel

Overview
- This backend uses FastAPI and is configured to run on Vercel Functions with the Python runtime.

Structure
- api/index.py: Thin entrypoint exposing `app` from server.py (ASGI).
- vercel.json: Configures Python runtime and routes `/api/*` to the backend function.
- requirements.txt: Python dependencies installed by Vercel during build.

Deploy Steps (CLI)
1. Install the Vercel CLI and login.
2. Link this folder as a Vercel project.
3. Deploy.

Commands (Windows PowerShell):
```
npm install -g vercel
vercel login
vercel link --cwd backend
vercel deploy --cwd backend --prod
```

Environment
- Set `MONGO_URL`, `DB_NAME`, and `JWT_SECRET` in the Vercel Project Settings → Environment Variables.
- Optionally update CORS in `server.py` to match your frontend domain.
