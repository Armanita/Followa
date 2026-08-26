#!/usr/bin/env bash
# Fetch the vendored pnpm seed tarballs required by the production API image.
#
# Why this exists: apps/api/Dockerfile pre-seeds the pnpm store with the two
# largest packages (prisma + @prisma/client) because their downloads fail
# repeatedly through the Docker NAT on some networks (MTU issue). The tarballs
# are ~43 MB combined, so they are NOT committed to git — this script
# reproduces them deterministically.
#
# Versions and integrity hashes are read from pnpm-lock.yaml. Nothing is
# hardcoded, nothing is "latest", and a hash mismatch is a hard failure.
#
# Usage:  bash scripts/fetch-pnpm-seed.sh
# Then:   docker compose -f docker-compose.prod.yml build

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCKFILE="$REPO_ROOT/pnpm-lock.yaml"
SEED_DIR="$REPO_ROOT/docker/pnpm-seed"
DOCKERFILE="$REPO_ROOT/apps/api/Dockerfile"
REGISTRY="${PNPM_SEED_REGISTRY:-https://registry.npmjs.org}"

die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

command -v openssl >/dev/null 2>&1 || die "openssl is required to verify integrity hashes."
[ -f "$LOCKFILE" ] || die "pnpm-lock.yaml not found at $LOCKFILE"

# base64-encoded sha512 of a file — the same form npm/pnpm records as "integrity"
file_integrity() {
  printf 'sha512-%s' "$(openssl dgst -sha512 -binary "$1" | openssl base64 -A)"
}

# Pull the exact locked version out of the lockfile's `packages:` section.
# Only pure-semver keys match, so peer-suffixed `snapshots:` keys are ignored.
locked_version() {
  local pattern="$1"
  grep -oE "$pattern" "$LOCKFILE" | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1
}

# The integrity line always directly follows the package key.
locked_integrity() {
  local key="$1"
  grep -A1 -F "  $key" "$LOCKFILE" | grep -oE 'sha512-[A-Za-z0-9+/=]+' | head -1
}

download() {
  local url="$1" dest="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fSL --retry 5 --retry-delay 3 --connect-timeout 30 -o "$dest" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q --tries=5 --timeout=30 -O "$dest" "$url"
  else
    die "neither curl nor wget is available"
  fi
}

# name | lockfile key pattern | lockfile key | url path | output basename
fetch_one() {
  local label="$1" pattern="$2" url_path="$3" out_prefix="$4"

  local version
  version="$(locked_version "$pattern")" || true
  [ -n "${version:-}" ] || die "could not resolve the locked version of $label from pnpm-lock.yaml"

  local key integrity
  case "$label" in
    prisma) key="prisma@${version}:" ;;
    *)      key="'@prisma/client@${version}':" ;;
  esac
  integrity="$(locked_integrity "$key")" || true
  [ -n "${integrity:-}" ] || die "could not resolve the locked integrity hash of $label@$version"

  local dest="$SEED_DIR/${out_prefix}-${version}.tgz"

  # Idempotent: a file that already matches the locked hash is left alone.
  if [ -f "$dest" ] && [ "$(file_integrity "$dest")" = "$integrity" ]; then
    printf 'ok    %-16s %-8s already present and verified\n' "$label" "$version"
    return 0
  fi

  printf 'fetch %-16s %-8s %s\n' "$label" "$version" "$REGISTRY/$url_path/${out_prefix}-${version}.tgz"
  local tmp="${dest}.part"
  rm -f "$tmp"
  download "$REGISTRY/$url_path/${out_prefix}-${version}.tgz" "$tmp" \
    || { rm -f "$tmp"; die "download failed for $label@$version"; }

  local actual
  actual="$(file_integrity "$tmp")"
  if [ "$actual" != "$integrity" ]; then
    rm -f "$tmp"
    die "integrity mismatch for $label@$version
  expected (pnpm-lock.yaml): $integrity
  actual   (downloaded):     $actual
Refusing to keep the file. Do not build with an unverified tarball."
  fi

  mv -f "$tmp" "$dest"
  printf 'ok    %-16s %-8s verified against pnpm-lock.yaml\n' "$label" "$version"
}

mkdir -p "$SEED_DIR"

fetch_one 'prisma'          "^  prisma@[0-9]+\.[0-9]+\.[0-9]+:$"            'prisma/-'         'prisma'
fetch_one '@prisma/client'  "^  '@prisma/client@[0-9]+\.[0-9]+\.[0-9]+':$"  '@prisma/client/-' 'client'

# Guard against drift: the Dockerfile references the seed tarballs by filename.
if [ -f "$DOCKERFILE" ]; then
  missing=0
  while read -r expected; do
    [ -n "$expected" ] || continue
    if [ ! -f "$SEED_DIR/$expected" ]; then
      printf 'WARNING: apps/api/Dockerfile expects docker/pnpm-seed/%s which was not produced.\n' "$expected" >&2
      missing=1
    fi
  done <<EOF
$(grep -oE '/tmp/seed/[a-z@/-]*[a-z]+-[0-9]+\.[0-9]+\.[0-9]+\.tgz' "$DOCKERFILE" | sed 's#.*/##' | sort -u)
EOF
  [ "$missing" -eq 0 ] || die "seed filenames do not match apps/api/Dockerfile — update one of them before building."
fi

printf '\nSeed ready in docker/pnpm-seed (intentionally untracked by git).\nNext: docker compose -f docker-compose.prod.yml build\n'
