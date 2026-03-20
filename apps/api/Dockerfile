# Stage 1: Install dependencies
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies for cffi/cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libffi-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install --no-cache-dir poetry==1.8.5

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Install all production dependencies directly (not via requirements.txt export)
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-dev --no-root

# Stage 2: Runtime
FROM python:3.12-slim AS runtime

WORKDIR /app

# Install runtime C libraries needed by cryptography/cffi
RUN apt-get update && apt-get install -y --no-install-recommends \
    libffi8 libssl3 curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder (installed system-wide)
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY alembic.ini ./

# Create non-root user
RUN addgroup --system app && adduser --system --ingroup app app
USER app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Run with uvicorn
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
