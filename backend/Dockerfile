# Backend Dockerfile for FastAPI
FROM python:3.11-slim
WORKDIR /app

# Install build deps and pip requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application
COPY . .

# Default envs (override in Vercel project settings)
ENV PORT=8000
EXPOSE 8000

# Run with Uvicorn
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
