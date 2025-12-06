#!/bin/bash

# Run all integration tests
# Usage: ./scripts/run-integration-tests.sh

set -e

echo "Running integration tests..."
echo "============================"

npx vitest run tests/integration

echo ""
echo "Integration tests completed successfully!"
