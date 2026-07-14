#!/bin/bash

# Redirect stderr to stdout so the caller sees all output in one stream.
exec 2>&1

set -e

# Get the directory where this script lives (the scripts/ folder).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Next.js project path
NEXTJS_PROJECT_DIR="/home/z/my-project"

# Verify the project directory exists
if [ ! -d "$NEXTJS_PROJECT_DIR" ]; then
    echo "ERROR: Next.js project directory not found: $NEXTJS_PROJECT_DIR"
    exit 1
fi

echo "Building Next.js app and mini-services..."
echo "Project path: $NEXTJS_PROJECT_DIR"

cd "$NEXTJS_PROJECT_DIR" || exit 1

export NEXT_TELEMETRY_DISABLED=1

BUILD_DIR="/tmp/build_fullstack_$BUILD_ID"
echo "Creating build directory: $BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Install dependencies
echo "Installing dependencies..."
bun install

# Build the Next.js app
echo "Building Next.js app..."
bun run build

# Build mini-services if the directory exists
if [ -d "$NEXTJS_PROJECT_DIR/mini-services" ]; then
    echo "Building mini-services..."
    sh "$SCRIPT_DIR/mini-services-install.sh"
    sh "$SCRIPT_DIR/mini-services-build.sh"

    # Copy the mini-services start script into the build output
    echo "  - Copying mini-services-start.sh to $BUILD_DIR"
    cp "$SCRIPT_DIR/mini-services-start.sh" "$BUILD_DIR/mini-services-start.sh"
    chmod +x "$BUILD_DIR/mini-services-start.sh"
else
    echo "No mini-services directory found, skipping."
fi

# Collect all build artifacts into the build directory
echo "Collecting build artifacts into $BUILD_DIR..."

# Copy Next.js standalone build output
if [ -d ".next/standalone" ]; then
    echo "  - Copying .next/standalone"
    cp -r .next/standalone "$BUILD_DIR/next-service-dist/"
fi

# Copy Next.js static files
if [ -d ".next/static" ]; then
    echo "  - Copying .next/static"
    mkdir -p "$BUILD_DIR/next-service-dist/.next"
    cp -r .next/static "$BUILD_DIR/next-service-dist/.next/"
fi

# Copy public directory
if [ -d "public" ]; then
    echo "  - Copying public"
    cp -r public "$BUILD_DIR/next-service-dist/"
fi

# Copy the test database into the build output (production uses this DB)
if [ -f "./db/custom.db" ]; then
    echo "Copying database into build output..."
    mkdir -p "$BUILD_DIR/db"
    cp -r ./db/. "$BUILD_DIR/db/"

    echo "Syncing database schema in build output..."
    DATABASE_URL="file:$BUILD_DIR/db/custom.db" bun run db:push
    echo "Build database ready."
    ls -lah "$BUILD_DIR/db"
else
    echo "ERROR: Database file ./db/custom.db not found. Cannot build production package."
    exit 1
fi

# Copy Caddyfile if it exists
if [ -f "Caddyfile" ]; then
    echo "  - Copying Caddyfile"
    cp Caddyfile "$BUILD_DIR/"
else
    echo "No Caddyfile found, skipping."
fi

# Copy the start script
echo "  - Copying start.sh to $BUILD_DIR"
cp "$SCRIPT_DIR/start.sh" "$BUILD_DIR/start.sh"
chmod +x "$BUILD_DIR/start.sh"

# Package everything into a tarball
PACKAGE_FILE="${BUILD_DIR}.tar.gz"
echo ""
echo "Packaging build output to $PACKAGE_FILE..."
cd "$BUILD_DIR" || exit 1
tar -czf "$PACKAGE_FILE" .
cd - > /dev/null || exit 1

echo ""
echo "Build complete! All artifacts packaged to $PACKAGE_FILE"
echo "Package size:"
ls -lh "$PACKAGE_FILE"
