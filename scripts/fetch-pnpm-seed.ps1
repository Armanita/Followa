# Fetch the vendored pnpm seed tarballs required by the production API image.
#
# Windows counterpart of scripts/fetch-pnpm-seed.sh — identical behaviour:
# versions and integrity hashes come from pnpm-lock.yaml, nothing is "latest",
# a hash mismatch is a hard failure, and existing valid files are left alone.
#
# Usage:  pwsh -File scripts/fetch-pnpm-seed.ps1
# Then:   docker compose -f docker-compose.prod.yml build

#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$lockFile   = Join-Path $repoRoot 'pnpm-lock.yaml'
$seedDir    = Join-Path $repoRoot 'docker/pnpm-seed'
$dockerFile = Join-Path $repoRoot 'apps/api/Dockerfile'
$registry   = if ($env:PNPM_SEED_REGISTRY) { $env:PNPM_SEED_REGISTRY } else { 'https://registry.npmjs.org' }

function Die([string]$Message) {
    Write-Host ''
    Write-Error "ERROR: $Message"
    exit 1
}

if (-not (Test-Path -LiteralPath $lockFile)) { Die "pnpm-lock.yaml not found at $lockFile" }

$lockLines = Get-Content -LiteralPath $lockFile

# base64-encoded sha512 of a file — the same form npm/pnpm records as "integrity"
function Get-FileIntegrity([string]$Path) {
    $sha = [System.Security.Cryptography.SHA512]::Create()
    try {
        $stream = [System.IO.File]::OpenRead($Path)
        try { $hash = $sha.ComputeHash($stream) } finally { $stream.Dispose() }
    } finally { $sha.Dispose() }
    return 'sha512-' + [Convert]::ToBase64String($hash)
}

# Pure-semver keys only, so peer-suffixed `snapshots:` keys are ignored.
function Get-LockedPackage([string]$KeyPattern) {
    for ($i = 0; $i -lt $lockLines.Count; $i++) {
        if ($lockLines[$i] -match $KeyPattern) {
            $version = [regex]::Match($lockLines[$i], '[0-9]+\.[0-9]+\.[0-9]+').Value
            # the integrity line always directly follows the package key
            $m = [regex]::Match($lockLines[$i + 1], 'sha512-[A-Za-z0-9+/=]+')
            if (-not $m.Success) { return $null }
            return [pscustomobject]@{ Version = $version; Integrity = $m.Value }
        }
    }
    return $null
}

function Get-Seed([string]$Label, [string]$KeyPattern, [string]$UrlPath, [string]$OutPrefix) {
    $pkg = Get-LockedPackage $KeyPattern
    if ($null -eq $pkg) { Die "could not resolve the locked version/integrity of $Label from pnpm-lock.yaml" }

    $dest = Join-Path $seedDir ("{0}-{1}.tgz" -f $OutPrefix, $pkg.Version)

    # Idempotent: a file that already matches the locked hash is left alone.
    if ((Test-Path -LiteralPath $dest) -and ((Get-FileIntegrity $dest) -eq $pkg.Integrity)) {
        Write-Host ("ok    {0,-16} {1,-8} already present and verified" -f $Label, $pkg.Version)
        return
    }

    $url = "{0}/{1}/{2}-{3}.tgz" -f $registry, $UrlPath, $OutPrefix, $pkg.Version
    Write-Host ("fetch {0,-16} {1,-8} {2}" -f $Label, $pkg.Version, $url)

    $tmp = "$dest.part"
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
    try {
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $url -OutFile $tmp -MaximumRetryCount 5 -RetryIntervalSec 3 -UseBasicParsing
    } catch {
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
        Die "download failed for $Label@$($pkg.Version): $($_.Exception.Message)"
    }

    $actual = Get-FileIntegrity $tmp
    if ($actual -ne $pkg.Integrity) {
        Remove-Item -LiteralPath $tmp -Force
        Die @"
integrity mismatch for $Label@$($pkg.Version)
  expected (pnpm-lock.yaml): $($pkg.Integrity)
  actual   (downloaded):     $actual
Refusing to keep the file. Do not build with an unverified tarball.
"@
    }

    Move-Item -LiteralPath $tmp -Destination $dest -Force
    Write-Host ("ok    {0,-16} {1,-8} verified against pnpm-lock.yaml" -f $Label, $pkg.Version)
}

New-Item -ItemType Directory -Force -Path $seedDir | Out-Null

Get-Seed 'prisma'         "^  prisma@[0-9]+\.[0-9]+\.[0-9]+:$"           'prisma/-'         'prisma'
Get-Seed '@prisma/client' "^  '@prisma/client@[0-9]+\.[0-9]+\.[0-9]+':$" '@prisma/client/-' 'client'

# Guard against drift: the Dockerfile references the seed tarballs by filename.
if (Test-Path -LiteralPath $dockerFile) {
    $expected = Select-String -LiteralPath $dockerFile -Pattern '/tmp/seed/\S*?([a-z]+-[0-9]+\.[0-9]+\.[0-9]+\.tgz)' -AllMatches |
        ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
    $missing = @($expected | Where-Object { -not (Test-Path -LiteralPath (Join-Path $seedDir $_)) })
    foreach ($m in $missing) {
        Write-Warning "apps/api/Dockerfile expects docker/pnpm-seed/$m which was not produced."
    }
    if ($missing.Count -gt 0) {
        Die 'seed filenames do not match apps/api/Dockerfile — update one of them before building.'
    }
}

Write-Host ''
Write-Host 'Seed ready in docker/pnpm-seed (intentionally untracked by git).'
Write-Host 'Next: docker compose -f docker-compose.prod.yml build'
