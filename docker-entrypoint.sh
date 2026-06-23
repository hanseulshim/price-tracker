#!/bin/sh
set -e

# Run database migrations on startup
echo "Running database migrations..."
DATABASE_URL="${DATABASE_URL:-file:/app/data/price-tracker.db}" npx prisma migrate deploy

# Seed default categories (upsert — safe to run every time)
echo "Seeding default categories..."
DATABASE_URL="${DATABASE_URL:-file:/app/data/price-tracker.db}" npm run db:seed

# Start the app
echo "Starting Price Tracker..."
exec npx next start -p "${PORT:-3000}"
