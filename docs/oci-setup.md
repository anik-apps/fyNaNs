# OCI Deployment Guide

Production deployment on Oracle Cloud Infrastructure (OCI) Always Free ARM VM.

## Infrastructure

| Resource | Spec | Tier |
|----------|------|------|
| Compute | VM.Standard.A1.Flex (Ampere ARM) | Always Free |
| CPUs | 4 OCPU | Always Free (max) |
| RAM | 24 GB | Always Free (max) |
| Boot volume | 200 GB | Always Free (max) |
| Object Storage | 20 GB (backups) | Always Free |

## 1. Provision the VM

### OCI Console Steps

1. **Compartment**: Create or use default
2. **Compute > Instances > Create Instance**
   - Name: `fynans-prod`
   - Image: Oracle Linux 9 (or Ubuntu 22.04)
   - Shape: `VM.Standard.A1.Flex` (ARM)
   - OCPUs: 4, Memory: 24 GB
   - Boot volume: 200 GB
   - Networking: Create new VCN + public subnet
   - SSH key: Upload your public key
3. **Networking > Virtual Cloud Networks > Security Lists**
   - Add ingress rules:
     - Port 80 (HTTP) from `0.0.0.0/0`
     - Port 443 (HTTPS) from `0.0.0.0/0`
     - Port 22 (SSH) from your IP only
4. **Object Storage > Create Bucket**
   - Name: `fynans-backups`
   - Storage tier: Standard
5. Note the **public IP address** of the VM
6. **Update DNS**: Create A record for `fynans.yourdomain.com` pointing to VM public IP

## 2. Server Setup

SSH into the VM and run the setup script:

```bash
ssh opc@<VM_PUBLIC_IP>  # Oracle Linux
# or
ssh ubuntu@<VM_PUBLIC_IP>  # Ubuntu

# Download and run setup script
curl -fsSL https://raw.githubusercontent.com/<your-repo>/main/scripts/setup-server.sh | bash
# Or clone first, then run:
git clone <your-repo> /opt/fynans
cd /opt/fynans
./scripts/setup-server.sh
```

The setup script installs:
- Docker and Docker Compose plugin
- OCI CLI
- Firewall rules (ports 80, 443)
- 4 GB swap file
- App directory at `/opt/fynans`

**After running**, log out and back in for Docker group changes to take effect.

## 3. Configure OCI CLI

```bash
oci setup config
```

Follow the prompts to set up your API key. You'll need:
- User OCID (from OCI Console > Profile)
- Tenancy OCID (from OCI Console > Tenancy Details)
- Region (e.g., `us-ashburn-1`)
- Generate a new API key pair and upload the public key to your OCI profile

## 4. Configure Environment

```bash
cd /opt/fynans
cp .env.production.example .env.production
```

Edit `.env.production` and fill in all values:

```bash
# Generate secrets
python3 -c "import secrets; print(secrets.token_urlsafe(64))"  # JWT_SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(32))"  # ENCRYPTION_MASTER_SECRET
python3 -c "import secrets; print(secrets.token_urlsafe(32))"  # POSTGRES_PASSWORD
```

Required values to set:
- `DOMAIN` - your domain name
- `ACME_EMAIL` - email for Let's Encrypt
- `POSTGRES_PASSWORD` - generated strong password
- `JWT_SECRET_KEY` - generated secret
- `ENCRYPTION_MASTER_SECRET` - generated secret
- `OCI_NAMESPACE` - from OCI Console > Tenancy Details

## 5. First Deployment

```bash
cd /opt/fynans
./scripts/deploy.sh
```

This will:
1. Build Docker images for FastAPI and Next.js
2. Start PostgreSQL and wait for health check
3. Run Alembic database migrations
4. Start all services (API, web, Caddy)
5. Caddy automatically obtains TLS certificate from Let's Encrypt

### Seed Default Data

```bash
docker compose -f docker-compose.prod.yml exec api python -m scripts.seed_categories
```

## 6. Verify Deployment

```bash
# Check all services are running
docker compose -f docker-compose.prod.yml ps

# Check API health
curl https://fynans.yourdomain.com/api/health

# Check logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f caddy
```

## 7. Set Up Automated Backups

```bash
# Create log directory
sudo mkdir -p /var/log/fynans
sudo chown $USER:$USER /var/log/fynans

# Test backup manually first
./scripts/backup-db.sh

# Verify backup in OCI
oci os object list --bucket-name fynans-backups --namespace $OCI_NAMESPACE --prefix "daily/" --output table

# Add cron job: daily at 2:00 AM UTC
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/fynans/scripts/backup-db.sh >> /var/log/fynans/backup.log 2>&1") | crontab -

# Verify cron
crontab -l
```

## 8. Ongoing Operations

### Deploy Updates

```bash
cd /opt/fynans
./scripts/deploy.sh
```

### View Logs

```bash
docker compose -f docker-compose.prod.yml logs -f [service]
# service: api, web, caddy, db
```

### Restart a Service

```bash
docker compose -f docker-compose.prod.yml restart api
```

### Restore from Backup

```bash
./scripts/restore-db.sh
# Lists available backups, then:
./scripts/restore-db.sh daily/fynans_2026-03-18_02-00-00.dump
```

### Check Disk Usage

```bash
df -h
docker system df
```

### Clean Up Docker

```bash
docker system prune -a --volumes  # WARNING: removes all unused images and volumes
```

## Firewall Checklist

Both **OCI Security List** (cloud firewall) and **OS firewall** must allow traffic:

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | Your IP | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP (Caddy redirects to HTTPS) |
| 443 | TCP | 0.0.0.0/0 | HTTPS |
| 443 | UDP | 0.0.0.0/0 | HTTP/3 (QUIC) |

The OS firewall is configured by `setup-server.sh`. The OCI Security List must be configured manually in the OCI Console.

## Architecture

```
Internet
    |
    v
[Caddy :80/:443]  -- auto HTTPS (Let's Encrypt)
    |
    +-- /api/*  --> [FastAPI :8000]  --> [PostgreSQL :5432]
    |
    +-- /*      --> [Next.js :3000]
```

All services run on a single Docker network. Only Caddy exposes ports to the internet. PostgreSQL is not accessible from outside the Docker network.
