FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1

# Install system dependencies required for GDAL, OpenCV, PyTorch, and Git (for LightGlue)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    gdal-bin \
    libgdal-dev \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt-get/lists/*

# Configure GDAL compiler paths
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

WORKDIR /app

# Upgrade pip and set up PyTorch CPU index
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY pyproject.toml .
COPY src/ src/
COPY api/ api/
COPY data/ data/
COPY data_generation/ data_generation/
COPY scripts/ scripts/

# Install SELENE-MATCH python package
RUN pip install --no-cache-dir -e .

# Create output directory structures and ensure baseline synthetic demo pair exists
RUN mkdir -p products data_generation/output && \
    python data_generation/generate_synthetic_pair.py --output_dir data_generation/output

EXPOSE 8000
ENV PORT=8000

# Run FastAPI backend with Uvicorn (binds dynamically to Render's $PORT or 8000)
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
