# Followa on Oracle Cloud Always Free — Deployment Runbook

Zero-cost public test environment. Everything except account signup is scripted.

---

## 1. Create the Oracle Cloud account (interactive — ~15 min, only you can do this)

1. Go to <https://www.oracle.com/cloud/free/> → **Start for free**.
2. Sign up with your email; verify phone/address. A credit card is required for
   **identity verification only** — Always Free resources are never charged.
3. Choose a **home region close to Iran users** (e.g. UAE East (Dubai) or
   Germany Central). Region cannot be changed later.
4. After login: the tenancy is already "Always Free" eligible. Do **not**
   upgrade to Paid.

## 2. Create the VM (OCI Console, ~5 min)

Compute → Instances → **Create Instance**:

| Setting | Value |
|---|---|
| Name | `followa-vm` |
| Image | **Ubuntu 22.04** (or 24.04) |
| Shape | **Ampere A1 Flex** → 2 OCPU / 12 GB (half the allowance; scale to 4/24 anytime) |
| Networking | default VCN; assign a **Public IPv4** |
| SSH keys | paste your public key (`~/.ssh/id_ed25519.pub`) |

Also open the cloud-level firewall (Security List / NSG): allow ingress TCP
**22, 80, 443** from `0.0.0.0/0`.

## 3. Bootstrap the server (~2 min)

```bash
ssh ubuntu@<VM_PUBLIC_IP>
sudo apt update && sudo apt install -y git
sudo git clone https://github.com/<you>/Followa.git /opt/followa   # private repo: use a deploy key or scp -r instead
cd /opt/followa
sudo bash scripts/oci-bootstrap.sh          # docker + compose + ufw (22/80/443 only)
```

## 4. Configure and launch

### 4a. Fetch pnpm seed tarballs (required before first build)

`apps/api/Dockerfile` pre-seeds the pnpm store with the two Prisma packages
(`prisma` + `@prisma/client`, ~43 MB combined) to work around a Docker NAT/MTU
issue that causes large tarball downloads to fail intermittently inside
`docker build`. These files are **not committed to git** — fetch them once on
the server before the initial build:

```bash
cd /opt/followa
bash scripts/fetch-pnpm-seed.sh
# downloads prisma-6.19.3.tgz and client-6.19.3.tgz into docker/pnpm-seed/
# verifies each file's SHA-512 against pnpm-lock.yaml — fails loudly on mismatch
# idempotent: re-running is safe, already-valid files are left untouched
```

On **Windows** (local development only):
```powershell
pwsh -File scripts\fetch-pnpm-seed.ps1
```

The script reads exact versions and integrity hashes from `pnpm-lock.yaml` —
nothing is "latest", no credentials are required, and a hash mismatch is a
hard failure.

### 4b. Set secrets and start the stack

```bash
cd /opt/followa
cp .env.prod.example .env
nano .env        # set POSTGRES_PASSWORD, JWT_SECRET, SYSTEM_ADMIN_PASSWORD
                 # (generate secrets: openssl rand -hex 48)

docker compose -f docker-compose.prod.yml up -d --build
```

Compose starts: postgres → migrate (prisma migrate deploy) → seed → api → web → caddy.
DB is **not** exposed publicly; only 80/443 are open.

Verify from the VM:

```bash
docker compose -f docker-compose.prod.yml ps           # all Up, migrate/seed Exited(0)
curl -s localhost/api/v1/health                        # {"status":"ok",...}
```

## 5. Public access & Android

- IP-only testing: `http://<VM_PUBLIC_IP>/` (web) and same origin `/api/v1/*`.
- Real HTTPS: point DNS A-records at the VM IP, then set in `.env`:
  `WEB_DOMAIN=app.yourdomain.com`, `API_DOMAIN=app.yourdomain.com`
  (same domain serves both; Caddy routes `/api/*` internally) and re-up Caddy.
  Certificates are issued automatically.
- Android build against it:
  ```bash
  flutter build apk --release \
    --dart-define=FOLLOWA_API=https://app.yourdomain.com/api/v1
  ```

## 6. Test checklist (run after every deploy)

1. Web loads: `http://IP/` → Persian RTL login page
2. Manager login: `09120000001 / manager1234`
3. Dashboard cards show seeded data
4. Create case + assign to employee → status «در انتظار پذیرش»
5. Employee accepts → «در حال انجام»
6. Start/end work session → duration recorded
7. Upload a file to the case → appears in files list
8. Restart stack (`docker compose restart api`) → uploaded file still present
   (volume-backed) → proves persistence
9. Reminder create → complete-with-result
10. Case result + complete → history intact for manager view

## 7. Operations

```bash
# logs
docker compose -f docker-compose.prod.yml logs -f api web
# rebuild after code change
git pull && docker compose -f docker-compose.prod.yml up -d --build
# database backup
docker exec followa-postgres pg_dump -U followa followa > backup_$(date +%F).sql
```

## 8. Known limitations of this environment

- OTP codes print to API logs under the mock provider:
  `docker compose logs api | grep otp:mock`
- HTTP-only if no domain configured (mobile cleartext is allowed since we set
  no `usesCleartextTraffic=false`; still, prefer real HTTPS via a free domain,
  e.g. a DuckDNS subdomain + `WEB_DOMAIN=<name>.duckdns.org`)
- Single VM = single point of failure; nightly `pg_dump` recommended (cron)
