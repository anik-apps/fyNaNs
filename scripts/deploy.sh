#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# fyNaNs Deployment Script
# Pulls latest code, builds containers, runs migrations, restarts services
# Usage: ./deploy.sh [--build-only | --migrate-only | --restart-only]
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"
ENV_FILE="$PROJECT_DIR/.env.production"

cd "$PROJECT_DIR"

# Check .env.production exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env.production not found!"
    echo "Copy .env.production.example to .env.production and fill in values."
    exit 1
fi

# Parse args
ACTION="${1:-full}"

echo "============================================="
echo "  fyNaNs Deployment - $(date)"
echo "============================================="

# --- Pull latest code ---
if [ "$ACTION" = "full" ] || [ "$ACTION" = "--build-only" ]; then
    echo ""
    echo "==> Pulling latest code..."
    git pull origin main
fi

# --- Build containers ---
if [ "$ACTION" = "full" ] || [ "$ACTION" = "--build-only" ]; then
    echo ""
    echo "==> Building Docker images..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache
fi

# --- Run database migrations ---
if [ "$ACTION" = "full" ] || [ "$ACTION" = "--migrate-only" ]; then
    echo ""
    echo "==> Running database migrations..."
    # Start just the DB first
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d db
    # Wait for DB to be healthy
    echo "==> Waiting for database..."
    sleep 5
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec db pg_isready -U fynans

    # Run migrations via API container (temporarily)
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm api \
        python -m alembic upgrade head
    echo "==> Migrations complete."
fi

# --- Start/restart all services ---
if [ "$ACTION" = "full" ] || [ "$ACTION" = "--restart-only" ]; then
    echo ""
    echo "==> Starting all services..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

    echo ""
    echo "==> Waiting for services to be healthy..."
    sleep 10

    # Check health
    echo ""
    echo "==> Service status:"
    docker compose -f "$COMPOSE_FILE" ps
fi

# --- Clean up old images ---
echo ""
echo "==> Cleaning up unused Docker images..."
docker image prune -f

echo ""
echo "============================================="
echo "  Deployment complete! - $(date)"
echo "============================================="
echo ""
echo "Useful commands:"
echo "  Logs:     docker compose -f docker-compose.prod.yml logs -f [service]"
echo "  Status:   docker compose -f docker-compose.prod.yml ps"
echo "  Restart:  docker compose -f docker-compose.prod.yml restart [service]"
echo "  Backup:   ./scripts/backup-db.sh"
