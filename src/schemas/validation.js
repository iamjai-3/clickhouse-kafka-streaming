import { z } from "zod";

// User schema validation
const userSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  age: z.number().int().min(1).max(150),
  city: z.string().min(1).max(100),
  created_at: z.string().datetime().optional(),
});

// Product schema validation
const productSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  price: z.number().positive().max(999999.99),
  stock: z.number().int().min(0),
  description: z.string().max(1000).optional(),
  created_at: z.string().datetime().optional(),
});

// Order schema validation
const orderSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive().max(1000),
  total_price: z.number().positive().max(999999.99),
  status: z.enum(["pending", "completed", "shipped", "cancelled"]),
  order_date: z.string().datetime().optional(),
});

// Kafka message wrapper schema
const kafkaMessageSchema = z.object({
  table: z.enum(["users", "products", "orders"]),
  data: z.any(), // Will be validated against specific schema
  timestamp: z.string().datetime().optional(),
  messageId: z.string().optional(),
});

// Validate user data
function validateUser(data) {
  return userSchema.parse(data);
}

// Validate product data
function validateProduct(data) {
  return productSchema.parse(data);
}

// Validate order data
function validateOrder(data) {
  return orderSchema.parse(data);
}

// Validate Kafka message and return validated data based on table type
function validateKafkaMessage(message) {
  const parsed = kafkaMessageSchema.parse(message);

  let validatedData;
  switch (parsed.table) {
    case "users":
      validatedData = validateUser(parsed.data);
      break;
    case "products":
      validatedData = validateProduct(parsed.data);
      break;
    case "orders":
      validatedData = validateOrder(parsed.data);
      break;
    default:
      throw new Error(`Unknown table type: ${parsed.table}`);
  }

  return {
    table: parsed.table,
    data: validatedData,
    timestamp: parsed.timestamp ?? new Date().toISOString(),
    messageId: parsed.messageId,
  };
}

export {
  userSchema,
  productSchema,
  orderSchema,
  kafkaMessageSchema,
  validateUser,
  validateProduct,
  validateOrder,
  validateKafkaMessage,
};
