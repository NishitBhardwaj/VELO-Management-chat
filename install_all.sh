# Remove global pnpm install
# npm install -g pnpm

export CI=true

# Install dependencies for all apps using npx pnpm
for d in apps/*; do
  if [ -d "$d" ]; then
    echo "Installing dependencies in $d..."
    # Pipe 'yes' to handle any "Proceed?" prompts automatically
    (cd "$d" && yes | npx -y pnpm install --no-frozen-lockfile)
  fi
done

echo "✅ All dependencies installed successfully!"
