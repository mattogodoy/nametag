#!/bin/bash

# Run all unit tests (lib and api tests)
# Usage: ./scripts/run-unit-tests.sh

set -e

echo "Running unit tests..."
echo "====================="

npx vitest run tests/lib tests/api

echo ""
echo "Unit tests completed successfully!"
