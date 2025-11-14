#!/bin/bash

# Script to install ClickHouse Kafka Connect Connector
# This script downloads and installs the connector in the Kafka Connect container

set -e

echo "🔍 Checking if Kafka Connect container is running..."
if ! docker ps | grep -q kafka-connect; then
    echo "❌ Kafka Connect container is not running. Please start it first:"
    echo "   docker-compose -f docker-compose.yml -f docker-compose.connect.yml up -d"
    exit 1
fi

echo "📦 Creating plugins directory..."
mkdir -p kafka-connect/plugins

echo "📥 Downloading ClickHouse Kafka Connect Connector..."
echo ""
echo "⚠️  Note: The ClickHouse connector is not available on Confluent Hub."
echo "   You need to download it manually from GitHub releases."
echo ""

# Try to get the latest release URL (correct repository name)
LATEST_RELEASE=$(curl -s https://api.github.com/repos/ClickHouse/clickhouse-kafka-connect/releases/latest 2>/dev/null | grep "browser_download_url.*zip" | cut -d '"' -f 4 | head -1)

if [ -z "$LATEST_RELEASE" ]; then
    echo "❌ Could not automatically fetch latest release from GitHub API."
    echo ""
    echo "📋 Manual Installation Steps:"
    echo "   1. Visit: https://github.com/ClickHouse/clickhouse-kafka-connect/releases"
    echo "   2. Download the latest ZIP file (e.g., clickhouse-kafka-connect-v*.zip)"
    echo "   3. Extract the ZIP and find the JAR file inside"
    echo "   4. Place the JAR in: kafka-connect/plugins/kafka-connect-clickhouse.jar"
    echo "   5. Restart Kafka Connect: docker restart kafka-connect"
    exit 1
fi

echo "✅ Found release: $LATEST_RELEASE"
echo "Downloading ZIP file..."
TEMP_ZIP=$(mktemp)
curl -L -f -o "$TEMP_ZIP" "$LATEST_RELEASE" || {
    echo ""
    echo "❌ Download failed. Please download manually:"
    echo "   https://github.com/ClickHouse/clickhouse-kafka-connect/releases"
    exit 1
}

echo "Extracting JAR from ZIP..."
# Extract JAR file from ZIP (look for .jar files in the zip)
TEMP_DIR=$(mktemp -d)
unzip -q "$TEMP_ZIP" -d "$TEMP_DIR" 2>/dev/null || {
    echo "❌ Failed to extract ZIP file."
    rm -rf "$TEMP_DIR"
    rm -f "$TEMP_ZIP"
    exit 1
}

# Find and copy JAR file (prefer confluent version if available)
JAR_FILE=$(find "$TEMP_DIR" -name "*.jar" -type f | head -1)
if [ -z "$JAR_FILE" ]; then
    echo "❌ No JAR file found in ZIP. Please extract manually."
    rm -rf "$TEMP_DIR"
    rm -f "$TEMP_ZIP"
    exit 1
fi

# Copy to plugins directory with standard name
cp "$JAR_FILE" kafka-connect/plugins/kafka-connect-clickhouse.jar
rm -rf "$TEMP_DIR"
rm -f "$TEMP_ZIP"

# Remove any old version-specific JAR files
find kafka-connect/plugins -name "clickhouse-kafka-connect-*.jar" ! -name "kafka-connect-clickhouse.jar" -delete 2>/dev/null || true

echo "✅ Connector downloaded successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Restart Kafka Connect: docker restart kafka-connect"
echo "   2. Wait for it to start (about 30 seconds)"
echo "   3. Deploy connectors using the JSON files in this directory"
echo ""
echo "Example:"
echo "   curl -X POST http://localhost:8083/connectors \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d @clickhouse-sink-users.json"

