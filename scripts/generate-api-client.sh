#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "==> Generating OpenAPI client from FastAPI..."

# Check if the API server is reachable
API_URL="${API_URL:-http://localhost:8000}"
if ! curl -sf "$API_URL/openapi.json" > /dev/null 2>&1; then
    echo "Error: FastAPI server not reachable at $API_URL"
    echo "Start the API first: cd apps/api && poetry run uvicorn src.main:app --reload"
    exit 1
fi

# Download the OpenAPI spec
SPEC_FILE="$PROJECT_ROOT/packages/api-client/openapi.json"
curl -sf "$API_URL/openapi.json" -o "$SPEC_FILE"
echo "==> Downloaded OpenAPI spec to $SPEC_FILE"

# Generate the TypeScript client
cd "$PROJECT_ROOT"
pnpm --filter @fynans/api-client generate
echo "==> TypeScript client generated successfully"

# Build the package
pnpm --filter @fynans/api-client build
echo "==> api-client package built successfully"

echo "==> Done! Client ready at packages/api-client/src/"
