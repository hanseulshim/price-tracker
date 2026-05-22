#!/bin/sh
set -e

# Run database migrations on startup
echo "Running database migrations..."
DATABASE_URL="${DATABASE_URL:-file:/app/data/price-tracker.db}" npx prisma migrate deploy

# Start the app
echo "Starting Price Tracker..."
exec npx next start -p "${PORT:-3000}"
