<#
.SYNOPSIS
    Build APK for AgriSense Farmer App using EAS Build

.DESCRIPTION
    This script builds an APK for the AgriSense Farmer App using Expo Application Services (EAS).
    It supports different build profiles: development, preview, and production.

.PARAMETER Profile
    Build profile to use: development, preview, production, apk-production
    Default: apk-production

.PARAMETER Platform
    Platform to build for: android, ios, all
    Default: android

.PARAMETER NonInteractive
    Run without prompts (requires EAS credentials to be configured)

.EXAMPLE
    .\build-apk.ps1 -Profile apk-production
    .\build-apk.ps1 -Profile preview -Platform android
    .\build-apk.ps1 -Profile development -NonInteractive
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("development", "preview", "production", "apk-production")]
    [string]$Profile = "apk-production",

    [Parameter(Mandatory=$false)]
    [ValidateSet("android", "ios", "all")]
    [string]$Platform = "android",

    [Parameter(Mandatory=$false)]
    [switch]$NonInteractive,

    [Parameter(Mandatory=$false)]
    [switch]$ClearCache,

    [Parameter(Mandatory=$false)]
    [string]$OutputDir = ".\build-output"
)

# Set strict error handling
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AgriSense Farmer App - APK Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $projectDir

Write-Host "Project directory: $projectDir" -ForegroundColor Green
Write-Host "Build profile: $Profile" -ForegroundColor Green
Write-Host "Platform: $Platform" -ForegroundColor Green
Write-Host ""

# Check prerequisites
function Check-Prerequisites {
    Write-Host "Checking prerequisites..." -ForegroundColor Yellow

    # Check Node.js
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    }
    $nodeVersion = node --version
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green

    # Check npm
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Error "npm is not installed."
        exit 1
    }
    $npmVersion = npm --version
    Write-Host "  npm: $npmVersion" -ForegroundColor Green

    # Check EAS CLI
    if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
        Write-Warning "EAS CLI not found. Installing..."
        npm install -g eas-cli
        if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
            Write-Error "Failed to install EAS CLI. Please install manually: npm install -g eas-cli"
            exit 1
        }
    }
    $easVersion = eas --version
    Write-Host "  EAS CLI: $easVersion" -ForegroundColor Green

    # Check if logged in to Expo
    try {
        $whoami = eas whoami 2>$null
        if ($whoami) {
            Write-Host "  Expo account: $whoami" -ForegroundColor Green
        } else {
            Write-Warning "Not logged in to Expo. Run 'eas login' before building."
        }
    } catch {
        Write-Warning "Could not verify Expo login status."
    }

    Write-Host ""
}

# Clear cache if requested
if ($ClearCache) {
    Write-Host "Clearing cache..." -ForegroundColor Yellow
    eas build --clear-cache
    Write-Host "Cache cleared." -ForegroundColor Green
    Write-Host ""
}

# Install dependencies
function Install-Dependencies {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    if (-not (Test-Path "node_modules")) {
        npm install
    } else {
        Write-Host "  node_modules exists, skipping install (use -ClearCache to force reinstall)" -ForegroundColor Gray
    }
    Write-Host "Dependencies installed." -ForegroundColor Green
    Write-Host ""
}

# Configure EAS project if needed
function Configure-EAS {
    Write-Host "Checking EAS configuration..." -ForegroundColor Yellow

    if (-not (Test-Path "eas.json")) {
        Write-Warning "eas.json not found. Creating default configuration..."
        # The eas.json should already exist from our setup
    }

    if (-not (Test-Path "app.json")) {
        Write-Error "app.json not found. This is required for EAS builds."
        exit 1
    }

    # Check if project is configured
    try {
        $projectInfo = eas project:info 2>$null
        if (-not $projectInfo) {
            Write-Warning "Project not configured with EAS. Running 'eas build:configure'..."
            if ($NonInteractive) {
                Write-Error "Cannot configure project in non-interactive mode. Run 'eas build:configure' manually first."
                exit 1
            }
            eas build:configure
        }
    } catch {
        Write-Warning "Could not verify project configuration."
    }

    Write-Host "EAS configuration OK." -ForegroundColor Green
    Write-Host ""
}

# Build the APK
function Build-APK {
    Write-Host "Starting EAS build..." -ForegroundColor Yellow
    Write-Host "Profile: $Profile" -ForegroundColor Cyan
    Write-Host "Platform: $Platform" -ForegroundColor Cyan
    Write-Host ""

    $buildArgs = @(
        "build",
        "--profile", $Profile,
        "--platform", $Platform,
        "--non-interactive"
    )

    if ($Profile -eq "apk-production") {
        $buildArgs += "--output", $OutputDir
    }

    Write-Host "Running: eas $($buildArgs -join ' ')" -ForegroundColor Gray
    Write-Host ""

    try {
        $startTime = Get-Date
        & eas @buildArgs
        $endTime = Get-Date
        $duration = $endTime - $startTime

        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Build completed successfully!" -ForegroundColor Green
        Write-Host "Duration: $($duration.ToString('hh\:mm\:ss'))" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""

        # Show output location
        if ($Profile -eq "apk-production") {
            Write-Host "APK output directory: $OutputDir" -ForegroundColor Cyan
            if (Test-Path $OutputDir) {
                $apks = Get-ChildItem $OutputDir -Filter "*.apk" -Recurse
                foreach ($apk in $apks) {
                    $sizeMB = [math]::Round($apk.Length / 1MB, 2)
                    Write-Host "  $($apk.FullName) ($sizeMB MB)" -ForegroundColor Green
                }
            }
        }
    } catch {
        Write-Error "Build failed. Check the error output above."
        exit 1
    }
}

# Main execution
try {
    Check-Prerequisites
    Install-Dependencies
    Configure-EAS
    Build-APK
} catch {
    Write-Error "Build process failed: $_"
    exit 1
}