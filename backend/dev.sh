#!/bin/bash
# Load .env file and start development server
set -a
source .env
set +a
pnpm dev
