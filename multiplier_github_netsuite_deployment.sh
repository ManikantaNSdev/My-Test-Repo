#!/bin/bash

# Multiplier GitHub NetSuite Deployment Script
# This script automates the deployment of NetSuite projects

set -e

# Default values
ENVIRONMENT="sandbox"
PROJECT_DIR="multiplier-netsuite-integration"
DEPLOY_MODE="validate_and_deploy"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -e|--environment)
      ENVIRONMENT="$2"
      shift
      shift
      ;;
    -d|--directory)
      PROJECT_DIR="$2"
      shift
      shift
      ;;
    -m|--mode)
      DEPLOY_MODE="$2"
      shift
      shift
      ;;
    -h|--help)
      echo "Usage: ./multiplier_github_netsuite_deployment.sh [options]"
      echo "Options:"
      echo "  -e, --environment    Target environment (sandbox or production)"
      echo "  -d, --directory      Project directory (default: multiplier-netsuite-integration)"
      echo "  -m, --mode           Deployment mode (validate_only, deploy_only, validate_and_deploy)"
      echo "  -h, --help           Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "sandbox" && "$ENVIRONMENT" != "production" ]]; then
  echo "Error: Environment must be 'sandbox' or 'production'"
  exit 1
fi

# Validate deployment mode
if [[ "$DEPLOY_MODE" != "validate_only" && "$DEPLOY_MODE" != "deploy_only" && "$DEPLOY_MODE" != "validate_and_deploy" ]]; then
  echo "Error: Mode must be 'validate_only', 'deploy_only', or 'validate_and_deploy'"
  exit 1
fi

# Load environment variables from .env file if it exists
if [ -f ".env.$ENVIRONMENT" ]; then
  echo "Loading environment variables from .env.$ENVIRONMENT"
  source ".env.$ENVIRONMENT"
else
  echo "Warning: .env.$ENVIRONMENT file not found. Using environment variables from shell."
fi

# Check for required environment variables for JWT auth
required_vars=("NS_ACCOUNT" "NS_CONSUMER_KEY" "NS_CERTIFICATE_ID" "NS_PRIVATE_KEY")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "Error: Required environment variable $var is not set"
    exit 1
  fi
done

# Create private key file from environment variable
echo "Creating private key file..."
mkdir -p ~/.suitecloud-sdk
echo "${NS_PRIVATE_KEY}" > ~/.suitecloud-sdk/private_key.pem
chmod 600 ~/.suitecloud-sdk/private_key.pem

# Create authentication config file
echo "Creating authentication config file..."
cat > ~/.suitecloud-sdk/authentication.json << EOF
{
  "account": "${NS_ACCOUNT}",
  "authId": "GitHub_${ENVIRONMENT}",
  "tokenInfo": {
    "consumerKey": "${NS_CONSUMER_KEY}",
    "certificateId": "${NS_CERTIFICATE_ID}",
    "certificateKeyFile": "~/.suitecloud-sdk/private_key.pem"
  }
}
EOF

# Navigate to project directory
echo "Changing to project directory: $PROJECT_DIR"
cd "$PROJECT_DIR" || { echo "Error: Could not change to directory $PROJECT_DIR"; exit 1; }

# Compile TypeScript if tsconfig.json exists
if [ -f "tsconfig.json" ]; then
  echo "Compiling TypeScript..."
  tsc
fi

# Run validation if needed
if [[ "$DEPLOY_MODE" == "validate_only" || "$DEPLOY_MODE" == "validate_and_deploy" ]]; then
  echo "Validating project..."
  suitecloud project:validate
fi

# Deploy if needed
if [[ "$DEPLOY_MODE" == "deploy_only" || "$DEPLOY_MODE" == "validate_and_deploy" ]]; then
  echo "Deploying to $ENVIRONMENT..."
  suitecloud project:deploy --accountspecificvalues=T
fi

echo "Deployment process completed successfully!"

# Clean up private key
rm -f ~/.suitecloud-sdk/private_key.pem
