# Manual Installation Guide

Since the ClickHouse Kafka Connect connector is **not available on Confluent Hub**, you need to install it manually.

## Step-by-Step Installation

### 1. Start Kafka Connect

```bash
docker-compose -f docker-compose.yml -f docker-compose.connect.yml up -d
```

Wait for Kafka Connect to be ready (about 30-60 seconds).

### 2. Download the Connector

Visit the GitHub releases page:
**https://github.com/ClickHouse/kafka-connect-clickhouse/releases**

Download the latest JAR file (e.g., `kafka-connect-clickhouse-1.0.0.jar`)

### 3. Place the JAR in the Plugins Directory

```bash
# Create the plugins directory if it doesn't exist
mkdir -p kafka-connect/plugins

# Copy the downloaded JAR file
# Replace <downloaded-file.jar> with the actual filename
cp <downloaded-file.jar> kafka-connect/plugins/kafka-connect-clickhouse.jar
```

**Or download directly with curl** (check releases page for latest version URL):

```bash
mkdir -p kafka-connect/plugins

# Example (update version number from releases page):
curl -L -o kafka-connect/plugins/kafka-connect-clickhouse.jar \
  https://github.com/ClickHouse/kafka-connect-clickhouse/releases/download/v1.0.0/kafka-connect-clickhouse-1.0.0.jar
```

### 4. Restart Kafka Connect

```bash
docker restart kafka-connect
```

Wait about 30 seconds for it to restart and load the connector.

### 5. Verify Installation

Check that the connector is loaded:

```bash
curl http://localhost:8083/connector-plugins | jq '.[] | select(.class | contains("ClickHouse"))'
```

You should see the ClickHouse connector listed.

### 6. Deploy Connectors

Now you can deploy the connectors:

```bash
# Deploy all at once
./kafka-connect/deploy-all.sh

# Or deploy individually
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @kafka-connect/clickhouse-sink-users.json
```

## Troubleshooting

### Connector Not Found

If you get "Connector class not found", verify:
1. The JAR file is in `kafka-connect/plugins/` directory
2. The file is named correctly (should end with `.jar`)
3. Kafka Connect has been restarted after placing the file
4. Check Kafka Connect logs: `docker logs kafka-connect`

### Check Connector Plugins

```bash
curl http://localhost:8083/connector-plugins | jq
```

Look for `com.clickhouse.kafka.connect.ClickHouseSinkConnector` in the list.

### Alternative: Copy JAR into Container

If the volume mount isn't working, you can copy the JAR directly into the container:

```bash
docker cp kafka-connect/plugins/kafka-connect-clickhouse.jar \
  kafka-connect:/usr/share/confluent-hub-components/kafka-connect-clickhouse.jar

docker restart kafka-connect
```

