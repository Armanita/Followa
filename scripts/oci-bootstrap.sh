#!/usr/bin/env bash
# Followa VM bootstrap — run once on a fresh Ubuntu 22.04/24.04 Oracle Cloud VM.
# Usage: sudo bash oci-bootstrap.sh
set -euo pipefail

echo "==> Base packages"
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl git ufw

echo "==> Docker Engine + Compose plugin"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

echo "==> Host firewall (ufw) — 22/80/443 only"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Kernel network settings (OCI instances need this for external traffic)"
# Oracle Ubuntu images ship with restrictive iptables rules; we keep them but
# ensure forwarding is allowed for Docker (Docker manages its own chains).
sysctl -w net.ipv4.ip_forward=1 || true

echo "==> App directory"
mkdir -p /opt/followa/storage/files
chown -R ${SUDO_USER:-ubuntu}: /opt/followa

echo "DONE. Next: copy the repo to /opt/followa, create .env, then:"
echo "  cd /opt/followa && docker compose -f docker-compose.prod.yml up -d --build"
