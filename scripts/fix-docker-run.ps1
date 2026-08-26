$targets = @(
  "$env:LOCALAPPDATA\Docker\run\dockerInference",
  "$env:LOCALAPPDATA\Docker\run\dockerEthernetVfkit",
  "$env:LOCALAPPDATA\Docker\run\userAnalyticsOtlpHttp.sock"
)
foreach ($t in $targets) {
  if (Test-Path -LiteralPath $t) {
    cmd /c rmdir "`"$t`"" 2>$null
    if (Test-Path -LiteralPath $t) {
      Write-Output "STILL_STUCK: $t"
    } else {
      Write-Output "REMOVED: $t"
    }
  }
}
