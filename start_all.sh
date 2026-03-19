echo "Starting backend services..."

export CI=true

# Start all backend services
for d in apps/*; do
  if [ -d "$d" ] && [ "$(basename "$d")" != "web-client" ]; then
    echo "Starting $(basename "$d")..."
    (cd "$d" && npx -y pnpm start:dev > run.log 2>&1) &
  fi
done

echo "Starting web client..."
# Start frontend
(cd apps/web-client && npx -y pnpm dev > run.log 2>&1) &

echo "✅ All services started in the background! Check run.log in each app folder for output."
