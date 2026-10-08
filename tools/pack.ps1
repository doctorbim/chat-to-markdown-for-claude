# Builds dist/chat-to-markdown-<version>.zip containing only the files Chrome needs.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$zip = Join-Path $dist "chat-to-markdown-$($manifest.version).zip"
if (Test-Path $zip) { Remove-Item $zip -Confirm:$false }

$files = 'manifest.json', 'popup.html', 'popup.js', 'convert.js', 'icons' | ForEach-Object { Join-Path $root $_ }
Compress-Archive -Path $files -DestinationPath $zip
Write-Output "Built $zip"
