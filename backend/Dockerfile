# Backend: FastAPI (Python) + Pillow + ffmpeg (video posters)
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# ffmpeg is required at runtime for video poster extraction. build-essential
# and the -dev headers let pip compile any package that lacks a prebuilt wheel
# (so the image builds reliably on any architecture / clean runner).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg build-essential libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Install Python deps first for better layer caching.
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# App code (uploads/ and .env are excluded via .dockerignore; uploads is a volume).
COPY . .

EXPOSE 8001

# Production server: no --reload, a couple of workers for throughput.
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
