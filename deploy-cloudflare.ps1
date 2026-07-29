# Cloudflare Pages deployment script.
# Version: 2026-07-29.4-file-creds-only
# Credentials are read only from the excluded file cloudflare-creds.example.txt.

param(
    [string] $ProjectName = 'cloudcertstore-poc',
    [string] $ProductionBranch = 'main',
    [string] $OutputDirectory = 'public',
    [string] $CredentialsFile = (Join-Path $PSScriptRoot 'cloudflare-creds.example.txt')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-CredentialFile {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw @"
Credentials file not found:
$Path

Create cloudflare-creds.example.txt beside this script with:
CLOUDFLARE_API_TOKEN=<your scoped Cloudflare API token>
CLOUDFLARE_ACCOUNT_ID=<your Cloudflare account ID>
"@
    }

    $values = @{}

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim().TrimStart([char]0xFEFF)

        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) {
            continue
        }

        $parts = $trimmed.Split('=', 2)
        if ($parts.Count -ne 2) {
            throw "Invalid credentials line. Expected KEY=VALUE: $trimmed"
        }

        $key = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"').Trim("'")

        if (-not [string]::IsNullOrWhiteSpace($key)) {
            $values[$key] = $value
        }
    }

    return $values
}

function Clear-CloudflareEnvironment {
    foreach ($name in @(
        'CLOUDFLARE_API_TOKEN',
        'CLOUDFLARE_API_KEY',
        'CLOUDFLARE_EMAIL',
        'CLOUDFLARE_ACCOUNT_ID',
        'CF_API_TOKEN',
        'CF_API_KEY',
        'CF_EMAIL',
        'CF_ACCOUNT_ID'
    )) {
        Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
}

try {
    Set-Location $PSScriptRoot

    Write-Host 'Script version: 2026-07-29.4-file-creds-only' -ForegroundColor DarkGray
    Write-Host 'Credential mode: excluded file only; nothing is hardcoded.' -ForegroundColor DarkGray

    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
        throw 'Node.js is not installed or is not available in PATH.'
    }

    if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) {
        throw 'npx.cmd is not available. Install Node.js with npm enabled.'
    }

    $resolvedOutputDirectory = Join-Path $PSScriptRoot $OutputDirectory
    if (-not (Test-Path -LiteralPath $resolvedOutputDirectory -PathType Container)) {
        throw "Deployment directory not found: $resolvedOutputDirectory"
    }

    $credentials = Read-CredentialFile -Path $CredentialsFile
    $apiToken = $credentials['CLOUDFLARE_API_TOKEN']
    $accountId = $credentials['CLOUDFLARE_ACCOUNT_ID']

    if ([string]::IsNullOrWhiteSpace($apiToken)) {
        throw "CLOUDFLARE_API_TOKEN is missing from $CredentialsFile."
    }

    if ([string]::IsNullOrWhiteSpace($accountId)) {
        throw "CLOUDFLARE_ACCOUNT_ID is missing from $CredentialsFile."
    }

    Clear-CloudflareEnvironment
    $env:CLOUDFLARE_API_TOKEN = $apiToken
    $env:CLOUDFLARE_ACCOUNT_ID = $accountId
    $env:NO_COLOR = '1'
    $env:FORCE_COLOR = '0'

    Write-Host "Credentials loaded from: $CredentialsFile" -ForegroundColor DarkGray
    Write-Host "Deploying '$OutputDirectory' to existing Pages project '$ProjectName'..." -ForegroundColor Cyan

    & npx.cmd --yes wrangler@latest pages deploy $OutputDirectory `
        "--project-name=$ProjectName" `
        "--branch=$ProductionBranch"

    if ($LASTEXITCODE -ne 0) {
        throw "Cloudflare Pages deployment failed with exit code $LASTEXITCODE."
    }

    Write-Host ''
    Write-Host 'Deployment completed successfully.' -ForegroundColor Green
    Write-Host "Production URL: https://$ProjectName.pages.dev" -ForegroundColor Green
}
finally {
    Clear-CloudflareEnvironment
    Remove-Item Env:NO_COLOR -ErrorAction SilentlyContinue
    Remove-Item Env:FORCE_COLOR -ErrorAction SilentlyContinue

    if (Get-Variable -Name apiToken -ErrorAction SilentlyContinue) {
        $apiToken = $null
    }
}
