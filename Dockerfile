# =============================================================================
# VeriGuard AI Backend — Railway Production Container
# =============================================================================
FROM python:3.11-slim

# Prevent Python from writing .pyc files & enable unbuffered logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies required for OpenCV, PyTorch & OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    zlib1g-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies with CPU PyTorch
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu torch torchvision && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Run database migration on container startup and launch Uvicorn
EXPOSE 8000
CMD ["sh", "-c", "python backend/scripts/migrate_to_supabase.py || true && uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
