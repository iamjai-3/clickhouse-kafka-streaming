import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: logFormat,
  defaultMeta: { service: "kafka-clickhouse-streaming" },
  transports: [
    // Error logs only
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // All logs (combined)
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Helper function to log table-specific operations
function logTableOperation(table, operation, data, metadata = {}) {
  const logData = {
    table,
    operation,
    ...metadata,
  };

  if (data) {
    logData.recordId = data.id ?? data.user_id ?? data.product_id;
    // Don't log full data object to reduce log size
  }

  logger.info(`[${table.toUpperCase()}] ${operation}`, logData);
}

// Helper function to log errors
function logError(table, operation, error, metadata = {}) {
  logger.error(`[${table?.toUpperCase() ?? "SYSTEM"}] ${operation} failed`, {
    table,
    operation,
    error: error.message,
    stack: error.stack,
    ...metadata,
  });
}

export { logger, logTableOperation, logError };
