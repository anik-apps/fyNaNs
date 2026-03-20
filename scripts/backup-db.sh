#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# fyNaNs Database Backup Script
# Dumps PostgreSQL and uploads to OCI Object Storage
# Retention: 7 daily + 4 weekly
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment
if [ -f "$PROJECT_DIR/.env.production" ]; then
    set -a
    source "$PROJECT_DIR/.env.production"
    set +a
fi

# Configuration
BACKUP_DIR="/tmp/fynans-backups"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
BACKUP_FILE="fynans_${DATE}.dump"

OCI_BUCKET="${OCI_BUCKET_NAME:-fynans-backups}"
OCI_NAMESPACE="${OCI_NAMESPACE}"
OCI_REGION="${OCI_REGION:-us-ashburn-1}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# --- Dump database ---
echo "[$(date)] Dumping database..."
docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T db pg_dump \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --format=custom \
    --compress=6 \
    > "$BACKUP_DIR/$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
echo "[$(date)] Dump complete: $BACKUP_FILE ($BACKUP_SIZE)"

# --- Upload to OCI Object Storage ---
echo "[$(date)] Uploading to OCI Object Storage..."

# Daily backup
oci os object put \
    --bucket-name "$OCI_BUCKET" \
    --namespace "$OCI_NAMESPACE" \
    --region "$OCI_REGION" \
    --name "daily/$BACKUP_FILE" \
    --file "$BACKUP_DIR/$BACKUP_FILE" \
    --force

echo "[$(date)] Uploaded daily/$BACKUP_FILE"

# Weekly backup (on Sundays)
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    oci os object put \
        --bucket-name "$OCI_BUCKET" \
        --namespace "$OCI_NAMESPACE" \
        --region "$OCI_REGION" \
        --name "weekly/$BACKUP_FILE" \
        --file "$BACKUP_DIR/$BACKUP_FILE" \
        --force
    echo "[$(date)] Uploaded weekly/$BACKUP_FILE"
fi

# --- Cleanup old backups ---
echo "[$(date)] Cleaning up old backups..."

# Delete daily backups older than 7 days
oci os object list \
    --bucket-name "$OCI_BUCKET" \
    --namespace "$OCI_NAMESPACE" \
    --region "$OCI_REGION" \
    --prefix "daily/" \
    --output json 2>/dev/null | \
python3 -c "
import json, sys
from datetime import datetime, timedelta
cutoff = datetime.now() - timedelta(days=7)
data = json.load(sys.stdin)
for obj in data.get('data', []):
    created = datetime.fromisoformat(obj['time-created'].replace('Z', '+00:00'))
    if created.replace(tzinfo=None) < cutoff:
        print(obj['name'])
" | while read -r name; do
    oci os object delete \
        --bucket-name "$OCI_BUCKET" \
        --namespace "$OCI_NAMESPACE" \
        --region "$OCI_REGION" \
        --name "$name" \
        --force
    echo "[$(date)] Deleted old daily: $name"
done

# Delete weekly backups older than 4 weeks
oci os object list \
    --bucket-name "$OCI_BUCKET" \
    --namespace "$OCI_NAMESPACE" \
    --region "$OCI_REGION" \
    --prefix "weekly/" \
    --output json 2>/dev/null | \
python3 -c "
import json, sys
from datetime import datetime, timedelta
cutoff = datetime.now() - timedelta(days=28)
data = json.load(sys.stdin)
for obj in data.get('data', []):
    created = datetime.fromisoformat(obj['time-created'].replace('Z', '+00:00'))
    if created.replace(tzinfo=None) < cutoff:
        print(obj['name'])
" | while read -r name; do
    oci os object delete \
        --bucket-name "$OCI_BUCKET" \
        --namespace "$OCI_NAMESPACE" \
        --region "$OCI_REGION" \
        --name "$name" \
        --force
    echo "[$(date)] Deleted old weekly: $name"
done

# Clean up local temp file
rm -f "$BACKUP_DIR/$BACKUP_FILE"

echo "[$(date)] Backup complete!"
