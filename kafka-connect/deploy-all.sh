#!/bin/bash

# Script to deploy all ClickHouse Kafka Connect Sink connectors

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KAFKA_CONNECT_URL="http://localhost:8083"

echo "🚀 Deploying ClickHouse Kafka Connect Sink Connectors..."
echo ""

# Check if Kafka Connect is running
if ! curl -s "$KAFKA_CONNECT_URL/connectors" > /dev/null; then
    echo "❌ Kafka Connect is not running or not accessible at $KAFKA_CONNECT_URL"
    echo "   Please start it first:"
    echo "   docker-compose -f docker-compose.yml -f docker-compose.connect.yml up -d"
    exit 1
fi

echo "✅ Kafka Connect is running"
echo ""

# Deploy Users connector
echo "📤 Deploying users-topic connector..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$KAFKA_CONNECT_URL/connectors" \
    -H "Content-Type: application/json" \
    -d @"$SCRIPT_DIR/clickhouse-sink-users.json")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Users connector deployed"
elif [ "$HTTP_CODE" = "409" ]; then
    echo "   ℹ️  Users connector already exists"
else
    echo "   ⚠️  Users connector deployment failed (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi

sleep 1

# Deploy Products connector
echo "📤 Deploying products-topic connector..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$KAFKA_CONNECT_URL/connectors" \
    -H "Content-Type: application/json" \
    -d @"$SCRIPT_DIR/clickhouse-sink-products.json")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Products connector deployed"
elif [ "$HTTP_CODE" = "409" ]; then
    echo "   ℹ️  Products connector already exists"
else
    echo "   ⚠️  Products connector deployment failed (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi

sleep 1

# Deploy Orders connector
echo "📤 Deploying orders-topic connector..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$KAFKA_CONNECT_URL/connectors" \
    -H "Content-Type: application/json" \
    -d @"$SCRIPT_DIR/clickhouse-sink-orders.json")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Orders connector deployed"
elif [ "$HTTP_CODE" = "409" ]; then
    echo "   ℹ️  Orders connector already exists"
else
    echo "   ⚠️  Orders connector deployment failed (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi

echo ""
echo "📋 Listing all connectors:"
curl -s "$KAFKA_CONNECT_URL/connectors" | jq '.'

echo ""
echo "✅ Done! Check connector status with:"
echo "   curl $KAFKA_CONNECT_URL/connectors/clickhouse-sink-users/status | jq"

