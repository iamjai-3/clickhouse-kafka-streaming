# Known Issue: ClickHouse Kafka Connect Connector

## Problem

The ClickHouse Kafka Connect connector (v1.3.4) has a bug where it:

1. Constructs URLs incorrectly: `http://clickhouse:8123/default?` instead of `http://clickhouse:8123?database=test`
2. Appends database name as a path (`/default`) instead of a query parameter
3. This causes ping failures: "Unable to ping ClickHouse instance"

## Error Details

```json
{
  "connector": { "state": "RUNNING" },
  "tasks": [
    {
      "state": "FAILED",
      "trace": "java.lang.RuntimeException: Connection to ClickHouse is not active."
    }
  ]
}
```

Logs show:

```
INFO ClickHouse URL: http://clickhouse:8123/default?
ERROR Unable to ping ClickHouse instance.
```

## Root Cause

The connector uses `hostname` and `port` to construct URLs and ignores `clickhouse.server.url`. It incorrectly formats the database as a path parameter.

## Solutions

### Option 1: Use Your Custom Consumer (Recommended ✅)

Your existing Node.js consumer works perfectly and provides:

- ✅ Zod validation
- ✅ Custom DLQ with detailed metadata
- ✅ Migration logs
- ✅ Idempotency tracking
- ✅ Proper error handling

**Status**: Fully functional and production-ready

### Option 2: Wait for Connector Fix

Monitor the connector repository for updates:

- https://github.com/ClickHouse/clickhouse-kafka-connect
- Current version: v1.3.4 (has this bug)
- Check for newer releases that fix the URL construction

### Option 3: Use Default Database (Workaround)

As a temporary workaround, you could:

1. Create tables in the `default` database instead of `test`
2. The connector will connect to `/default?` which might work for queries (but ping still fails)

**Not recommended** for production use.

## Verification

Network and authentication work correctly:

```bash
# This works:
docker exec kafka-connect sh -c 'echo "SELECT 1" | curl -s -u admin:admin123 "http://clickhouse:8123?database=test" --data-binary @-'
# Output: 1

# Ping works:
docker exec kafka-connect sh -c 'curl -s "http://clickhouse:8123/ping"'
# Output: Ok.
```

The issue is purely in how the connector constructs URLs.

## Recommendation

**Use your custom consumer** - it's already working, has more features, and doesn't have this bug.
