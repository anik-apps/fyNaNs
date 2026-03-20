#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# fyNaNs Database Restore Script
# Downloads backup from OCI Object Storage and restores
# Usage: ./restore-db.sh [backup_object_name]
# Example: ./restore-db.sh daily/fynans_2026-03-18_02-00-00.dump
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment
if [ -f "$PROJECT_DIR/.env.production" ]; then
    set -a
    source "$PROJECT_DIR/.env.production"
    set +a
fi

BACKUP_NAME="${1:-}"
RESTORE_DIR="/tmp/fynans-restore"

OCI_BUCKET="${OCI_BUCKET_NAME:-fynans-backups}"
OCI_NAMESPACE="${OCI_NAMESPACE}"
OCI_REGION="${OCI_REGION:-us-ashburn-1}"

if [ -z "$BACKUP_NAME" ]; then
    echo "Usage: $0 <backup_object_name>"
    echo ""
    echo "Available backups:"
    echo "--- Daily ---"
    oci os object list \
        --bucket-name "$OCI_BUCKET" \
        --namespace "$OCI_NAMESPACE" \
        --region "$OCI_REGION" \
        --prefix "daily/" \
        --output table \
        --query 'data[*].{name:name, size:"size", created:"time-created"}'
    echo ""
    echo "--- Weekly ---"
    oci os object list \
        --bucket-name "$OCI_BUCKET" \
        --namespace "$OCI_NAMESPACE" \
        --region "$OCI_REGION" \
        --prefix "weekly/" \
        --output table \
        --query 'data[*].{name:name, size:"size", created:"time-created"}'
    exit 1
fi

mkdir -p "$RESTORE_DIR"
LOCAL_FILE="$RESTORE_DIR/restore.dump"

echo "[$(date)] Downloading backup: $BACKUP_NAME"
oci os object get \
    --bucket-name "$OCI_BUCKET" \
    --namespace "$OCI_NAMESPACE" \
    --region "$OCI_REGION" \
    --name "$BACKUP_NAME" \
    --file "$LOCAL_FILE"

echo ""
echo "WARNING: This will DROP and recreate the database!"
echo "Database: ${POSTGRES_DB}"
read -p "Are you sure? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    rm -f "$LOCAL_FILE"
    exit 0
fi

echo "[$(date)] Stopping API service..."
cd "$PROJECT_DIR"
docker compose -f docker-compose.prod.yml stop api web

echo "[$(date)] Restoring database..."
docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T db pg_restore \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --clean \
    --if-exists \
    < "$LOCAL_FILE"

echo "[$(date)] Restarting services..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Clean up
rm -f "$LOCAL_FILE"

echo "[$(date)] Restore complete!"
