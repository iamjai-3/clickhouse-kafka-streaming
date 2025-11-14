# Kafka Connect Setup for ClickHouse

This directory contains configuration files for using Kafka Connect Sink with ClickHouse.

## Prerequisites

1. **Install ClickHouse Kafka Connect Connector**

   The connector needs to be installed manually since it's not available on Confluent Hub. You have two options:

   ### Option A: Use the Install Script (Recommended)

   ```bash
   # Make sure Kafka Connect is running first
   docker-compose -f docker-compose.yml -f docker-compose.connect.yml up -d

   # Run the install script
   ./kafka-connect/install-connector.sh

   # Restart Kafka Connect to load the connector
   docker restart kafka-connect
   ```

   ### Option B: Manual Installation

   ```bash
   # Create plugins directory
   mkdir -p kafka-connect/plugins

   # Download the connector ZIP manually
   # Visit: https://github.com/ClickHouse/clickhouse-kafka-connect/releases
   # Download the latest ZIP file (e.g., clickhouse-kafka-connect-v1.3.4.zip)
   # Extract the ZIP and find the JAR file inside
   # Place the JAR in kafka-connect/plugins/kafka-connect-clickhouse.jar

   # Example with curl (check releases page for latest version):
   # curl -L -o /tmp/connector.zip \
   #   https://github.com/ClickHouse/clickhouse-kafka-connect/releases/download/v1.3.4/clickhouse-kafka-connect-v1.3.4.zip
   # unzip /tmp/connector.zip -d /tmp/
   # cp /tmp/clickhouse-kafka-connect-*/clickhouse-kafka-connect-*-confluent.jar \
   #    kafka-connect/plugins/kafka-connect-clickhouse.jar

   # Restart Kafka Connect
   docker restart kafka-connect
   ```

2. **Start Services with Kafka Connect**

   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.connect.yml up -d
   ```

## Deploying Connectors

### Deploy Users Connector

```bash
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @kafka-connect/clickhouse-sink-users.json
```

### Deploy Products Connector

```bash
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @kafka-connect/clickhouse-sink-products.json
```

### Deploy Orders Connector

```bash
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @kafka-connect/clickhouse-sink-orders.json
```

## Managing Connectors

### List All Connectors

```bash
curl http://localhost:8083/connectors
```

### Get Connector Status

```bash
curl http://localhost:8083/connectors/clickhouse-sink-users/status
```

### Get Connector Configuration

```bash
curl http://localhost:8083/connectors/clickhouse-sink-users/config
```

### Delete a Connector

```bash
curl -X DELETE http://localhost:8083/connectors/clickhouse-sink-users
```

### Restart a Connector

```bash
curl -X POST http://localhost:8083/connectors/clickhouse-sink-users/restart
```

## Message Format

⚠️ **Important**: The Kafka Connect connector expects messages with the **data directly in the message value**, not wrapped in a `data` field.

### Current Producer Format (for Custom Consumer)

Your current producer sends messages like this:

```json
{
  "table": "users",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "age": 30,
    "city": "New York"
  },
  "messageId": "...",
  "timestamp": "..."
}
```

### Required Format for Kafka Connect

The connector expects messages like this:

```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30,
  "city": "New York"
}
```

### Solutions

**Option 1**: Modify your producer to send data directly (simplest for Kafka Connect)

```javascript
// In producer.js, change the message format
value: JSON.stringify(msg.data), // Instead of JSON.stringify(msg)
```

**Option 2**: Use a Single Message Transform (SMT) to extract `data` field
Add to connector config:

```json
{
  "transforms": "extractData",
  "transforms.extractData.type": "org.apache.kafka.connect.transforms.ExtractField$Value",
  "transforms.extractData.field": "data"
}
```

**Option 3**: Keep using your custom consumer (recommended if you need validation/DLQ)
Your custom consumer already handles the wrapped format perfectly and provides additional features.

## Comparison: Kafka Connect vs Custom Consumer

### Kafka Connect Advantages:

- ✅ Standardized, industry-proven solution
- ✅ Built-in retry and error handling
- ✅ Easy to scale (multiple tasks)
- ✅ REST API for management
- ✅ Automatic offset management
- ✅ Supports multiple data formats (JSON, Avro, etc.)

### Custom Consumer Advantages (Your Current Solution):

- ✅ Full control over validation (Zod schemas)
- ✅ Custom DLQ handling with detailed error context
- ✅ Migration logs tracking
- ✅ Idempotency with `processed_events` table
- ✅ Custom transformation logic
- ✅ Batch-level logging
- ✅ Easy to customize and extend

## Recommendation

**For Production**: Consider using Kafka Connect if:

- You need standardized, maintainable solution
- You want to leverage connector ecosystem
- You don't need custom validation/transformation

**For Custom Requirements**: Keep your custom consumer if:

- You need Zod validation
- You need custom DLQ with detailed metadata
- You need migration logs
- You need custom idempotency logic

**Hybrid Approach**: You can use both:

- Kafka Connect for simple, high-volume streams
- Custom consumer for complex validation/transformation needs

## Troubleshooting

### Check Kafka Connect Logs

```bash
docker logs kafka-connect
```

### Check Connector Errors

```bash
curl http://localhost:8083/connectors/clickhouse-sink-users/status | jq
```

### Verify ClickHouse Connection

```bash
curl -u admin:admin123 "http://localhost:8123?query=SELECT count() FROM users"
```

### Common Issues

1. **Connector not found**: Make sure the connector JAR is in `kafka-connect/plugins/`
2. **Connection refused**: Check ClickHouse is accessible from Kafka Connect container
3. **Table doesn't exist**: Create tables in ClickHouse before starting connector
4. **Schema mismatch**: Ensure Kafka message format matches ClickHouse table schema
