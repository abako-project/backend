#!/bin/bash

# Change to script directory
cd "$(dirname "$0")"

# If a specific service is provided, show its logs
if [ -n "$1" ]; then
  echo "Logs for: $1"
  echo ""
  docker compose -f docker-compose.dev.yml logs -f "$1"
else
  echo "Logs for all services"
  echo ""
  echo "To view logs for a specific service: $0 <service>"
  echo "   Available services: zombienet, contracts-api, virto-api, adapter-api"
  echo ""
  docker compose -f docker-compose.dev.yml logs -f
fi
