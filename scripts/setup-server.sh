#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# OCI ARM VM Setup Script for fyNaNs
# Run this once on a fresh Oracle Cloud Infrastructure ARM VM
# Tested on: Oracle Linux 8/9, Ubuntu 22.04+ (aarch64)
# =============================================================================

echo "==> fyNaNs Server Setup"
echo "==> Target: OCI ARM VM (Ampere A1, 4 OCPU, 24GB RAM)"

# --- Detect OS ---
if [ -f /etc/oracle-release ]; then
    OS="oracle"
elif [ -f /etc/lsb-release ]; then
    OS="ubuntu"
else
    echo "Unsupported OS. Use Oracle Linux or Ubuntu."
    exit 1
fi

echo "==> Detected OS: $OS"

# --- System updates ---
echo "==> Updating system packages..."
if [ "$OS" = "oracle" ]; then
    sudo dnf update -y
    sudo dnf install -y git curl wget unzip
elif [ "$OS" = "ubuntu" ]; then
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y git curl wget unzip
fi

# --- Install Docker ---
echo "==> Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
    sudo systemctl enable docker
    sudo systemctl start docker
    echo "==> Docker installed. You may need to log out and back in for group changes."
else
    echo "==> Docker already installed."
fi

# --- Install Docker Compose plugin ---
echo "==> Installing Docker Compose plugin..."
if ! docker compose version &> /dev/null; then
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d'"' -f4)
    sudo curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-aarch64" \
        -o /usr/local/lib/docker/cli-plugins/docker-compose
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
else
    echo "==> Docker Compose already installed."
fi

# --- Install OCI CLI ---
echo "==> Installing OCI CLI..."
if ! command -v oci &> /dev/null; then
    bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)" -- --accept-all-defaults
    echo 'export PATH=$PATH:$HOME/bin' >> ~/.bashrc
    export PATH=$PATH:$HOME/bin
    echo "==> OCI CLI installed. Run 'oci setup config' to configure."
else
    echo "==> OCI CLI already installed."
fi

# --- Firewall rules ---
echo "==> Configuring firewall..."
if [ "$OS" = "oracle" ]; then
    sudo firewall-cmd --permanent --add-port=80/tcp
    sudo firewall-cmd --permanent --add-port=443/tcp
    sudo firewall-cmd --reload
elif [ "$OS" = "ubuntu" ]; then
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw --force enable
fi

# --- Create app directory ---
echo "==> Creating application directory..."
sudo mkdir -p /opt/fynans
sudo chown "$USER":"$USER" /opt/fynans

# --- Swap file (recommended for 24GB RAM VMs under heavy Docker load) ---
echo "==> Setting up 4GB swap file..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
else
    echo "==> Swap already configured."
fi

echo ""
echo "==> Server setup complete!"
echo ""
echo "Next steps:"
echo "  1. Log out and back in (for Docker group)"
echo "  2. Run: oci setup config"
echo "  3. Clone repo to /opt/fynans"
echo "  4. Copy .env.production.example to .env.production and fill values"
echo "  5. Run: ./scripts/deploy.sh"
