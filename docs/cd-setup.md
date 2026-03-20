# CD Setup — Auto-deploy to OCI

## Prerequisites

1. OCI ARM VM provisioned and accessible via SSH
2. Server setup complete (ran `scripts/setup-server.sh`)
3. `.env.production` configured on the server at `/opt/fynans/.env.production`
4. Initial deployment done manually once (`scripts/deploy.sh`)

## GitHub Secrets

Add these in GitHub → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `OCI_HOST` | Your VM's public IP (e.g., `129.xxx.xxx.xxx`) |
| `OCI_USER` | SSH username (e.g., `ubuntu` or `opc`) |
| `OCI_SSH_KEY` | Your private SSH key (the full `-----BEGIN ... END-----` block) |

### Getting your SSH key

```bash
# If you used the default key during OCI VM setup:
cat ~/.ssh/id_rsa

# Or if you created a specific key:
cat ~/.ssh/oci_fynans
```

Copy the entire output including the BEGIN/END lines.

## How It Works

1. Push to `main` (or merge a PR) triggers the deploy workflow
2. GitHub SSHs into the OCI VM
3. Pulls latest code from git
4. Builds Docker containers
5. Runs Alembic migrations
6. Restarts all services
7. Verifies health check

## Manual Trigger

You can also trigger a deploy manually:
- Go to Actions → "Deploy to OCI" → "Run workflow" → Select `main` branch

## First Time Setup on the Server

```bash
# SSH into your OCI VM
ssh ubuntu@YOUR_VM_IP

# Clone the repo
sudo mkdir -p /opt/fynans
sudo chown $USER:$USER /opt/fynans
git clone https://github.com/anik-apps/fyNaNs.git /opt/fynans
cd /opt/fynans

# Create production env file
cp .env.production.example .env.production
# Edit with your real secrets:
nano .env.production

# First deploy
chmod +x scripts/deploy.sh
./scripts/deploy.sh

# Set up backup cron
chmod +x scripts/backup-db.sh
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/fynans/scripts/backup-db.sh >> /var/log/fynans-backup.log 2>&1") | crontab -
```

## Environment Protection

The deploy job uses the `production` environment in GitHub Actions. You can configure:
- **Required reviewers** — require approval before deploy
- **Wait timer** — add delay between CI pass and deploy
- **Deployment branches** — restrict to `main` only

Go to GitHub → Settings → Environments → Create "production" to configure these.
