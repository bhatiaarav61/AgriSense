#!/bin/bash
# AgriSense Farmer App - APK Builder (Linux/macOS)
# Builds APK using Expo Application Services (EAS)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Default values
PROFILE="apk-production"
PLATFORM="android"
NON_INTERACTIVE=false
CLEAR_CACHE=false
OUTPUT_DIR="./build-output"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--profile)
            PROFILE="$2"
            shift 2
            ;;
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        --non-interactive)
            NON_INTERACTIVE=true
            shift
            ;;
        --clear-cache)
            CLEAR_CACHE=true
            shift
            ;;
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -h|--help)
            echo "AgriSense Farmer App - APK Builder"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -p, --profile <profile>     Build profile (development, preview, production, apk-production)"
            echo "  --platform <platform>       Platform to build (android, ios, all)"
            echo "  --non-interactive           Run without prompts"
            echo "  --clear-cache               Clear EAS cache before building"
            echo "  --output-dir <dir>          Output directory for APK"
            echo "  -h, --help                  Show this help"
            echo ""
            echo "Profiles:"
            echo "  development    - Development build with dev client"
            echo "  preview        - Preview build for testing"
            echo "  production     - Production build (AAB for Play Store)"
            echo "  apk-production - Production APK for direct distribution"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Validate profile
VALID_PROFILES=("development" "preview" "production" "apk-production")
if [[ ! " ${VALID_PROFILES[@]} " =~ " ${PROFILE} " ]]; then
    echo -e "${RED}Invalid profile: $PROFILE${NC}"
    echo "Valid profiles: ${VALID_PROFILES[*]}"
    exit 1
fi

# Validate platform
VALID_PLATFORMS=("android" "ios" "all")
if [[ ! " ${VALID_PLATFORMS[@]} " =~ " ${PLATFORM} " ]]; then
    echo -e "${RED}Invalid platform: $PLATFORM${NC}"
    echo "Valid platforms: ${VALID_PLATFORMS[*]}"
    exit 1
fi

echo -e "${CYAN}========================================"
echo "AgriSense Farmer App - APK Builder"
echo "========================================${NC}"
echo ""
echo -e "Project directory: ${GREEN}$(pwd)${NC}"
echo -e "Build profile: ${GREEN}$PROFILE${NC}"
echo -e "Platform: ${GREEN}$PLATFORM${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "  Node.js: ${GREEN}$NODE_VERSION${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed.${NC}"
    exit 1
fi
NPM_VERSION=$(npm --version)
echo -e "  npm: ${GREEN}$NPM_VERSION${NC}"

# Check EAS CLI
if ! command -v eas &> /dev/null; then
    echo -e "${YELLOW}EAS CLI not found. Installing...${NC}"
    npm install -g eas-cli
    if ! command -v eas &> /dev/null; then
        echo -e "${RED}Failed to install EAS CLI. Please install manually: npm install -g eas-cli${NC}"
        exit 1
    fi
fi
EAS_VERSION=$(eas --version)
echo -e "  EAS CLI: ${GREEN}$EAS_VERSION${NC}"

# Check Expo login
if eas whoami &> /dev/null; then
    WHOAMI=$(eas whoami)
    echo -e "  Expo account: ${GREEN}$WHOAMI${NC}"
else
    echo -e "${YELLOW}Not logged in to Expo. Run 'eas login' before building.${NC}"
fi

echo ""

# Clear cache if requested
if [ "$CLEAR_CACHE" = true ]; then
    echo -e "${YELLOW}Clearing cache...${NC}"
    eas build --clear-cache
    echo -e "${GREEN}Cache cleared.${NC}"
    echo ""
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    npm install
else
    echo -e "  ${GRAY}node_modules exists, skipping install (use --clear-cache to force reinstall)${NC}"
fi
echo -e "${GREEN}Dependencies installed.${NC}"
echo ""

# Check EAS configuration
echo -e "${YELLOW}Checking EAS configuration...${NC}"

if [ ! -f "eas.json" ]; then
    echo -e "${YELLOW}eas.json not found.${NC}"
fi

if [ ! -f "app.json" ]; then
    echo -e "${RED}app.json not found. This is required for EAS builds.${NC}"
    exit 1
fi

# Check if project is configured with EAS
if ! eas project:info &> /dev/null; then
    echo -e "${YELLOW}Project not configured with EAS.${NC}"
    if [ "$NON_INTERACTIVE" = true ]; then
        echo -e "${RED}Cannot configure project in non-interactive mode. Run 'eas build:configure' manually first.${NC}"
        exit 1
    fi
    echo -e "${YELLOW}Running 'eas build:configure'...${NC}"
    eas build:configure
fi

echo -e "${GREEN}EAS configuration OK.${NC}"
echo ""

# Build the APK
echo -e "${YELLOW}Starting EAS build...${NC}"
echo -e "Profile: ${CYAN}$PROFILE${NC}"
echo -e "Platform: ${CYAN}$PLATFORM${NC}"
echo ""

BUILD_ARGS=("build" "--profile" "$PROFILE" "--platform" "$PLATFORM" "--non-interactive")

if [ "$PROFILE" = "apk-production" ]; then
    BUILD_ARGS+=("--output" "$OUTPUT_DIR")
fi

echo -e "${GRAY}Running: eas ${BUILD_ARGS[*]}${NC}"
echo ""

START_TIME=$(date +%s)

if eas "${BUILD_ARGS[@]}"; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    HOURS=$((DURATION / 3600))
    MINUTES=$(( (DURATION % 3600) / 60 ))
    SECONDS=$((DURATION % 60))

    echo ""
    echo -e "${GREEN}========================================"
    echo "Build completed successfully!"
    printf "Duration: %02d:%02d:%02d\n" $HOURS $MINUTES $SECONDS
    echo -e "========================================${NC}"
    echo ""

    # Show output location
    if [ "$PROFILE" = "apk-production" ]; then
        echo -e "APK output directory: ${CYAN}$OUTPUT_DIR${NC}"
        if [ -d "$OUTPUT_DIR" ]; then
            find "$OUTPUT_DIR" -name "*.apk" -type f | while read -r apk; do
                SIZE_MB=$(du -m "$apk" | cut -f1)
                echo -e "  ${GREEN}$apk (${SIZE_MB} MB)${NC}"
            done
        fi
    fi
else
    echo -e "${RED}Build failed. Check the error output above.${NC}"
    exit 1
fi