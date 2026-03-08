FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY engine/ engine/
COPY alembic/ alembic/
COPY alembic.ini .
COPY pyproject.toml .

# Copy the pre-trained ML model so inference works immediately on startup.
# If you retrain locally, rebuild the image to pick up the new model.
COPY data/load_estimator.joblib data/load_estimator.joblib

# Run Alembic migrations then start the server.
# The PORT env var is injected by Railway; main.py reads it automatically.
CMD alembic upgrade head && python -m engine.main
