import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  customType,
  index,
  uniqueIndex,
  inet,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Custom bytea type for encrypted data
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value: Buffer): Buffer {
    return value;
  },
  fromDriver(value: Buffer): Buffer {
    return value;
  },
});

// =============================================================================
// ADMIN USERS
// =============================================================================

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  totpSecret: text("totp_secret"), // encrypted, nullable
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  role: varchar("role", { length: 50 }).notNull().default("admin"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// =============================================================================
// ADMIN SESSIONS
// =============================================================================

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_sessions_user_id").on(table.userId),
    index("idx_sessions_expires_at").on(table.expiresAt),
  ],
);

// =============================================================================
// CATEGORIES
// =============================================================================

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_categories_sort_order").on(table.sortOrder),
  ],
);

// =============================================================================
// PRODUCTS
// =============================================================================

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    shortDesc: varchar("short_desc", { length: 500 }),
    imageUrl: varchar("image_url", { length: 2048 }),
    price: integer("price").notNull(), // in cents
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    sortOrder: integer("sort_order").notNull().default(0),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_products_status_sort").on(table.status, table.sortOrder),
    index("idx_products_category").on(table.categoryId),
  ],
);

// =============================================================================
// ORDERS
// =============================================================================

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderCode: varchar("order_code", { length: 20 }).notNull().unique(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    subtotal: integer("subtotal").notNull(),
    total: integer("total").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    notes: text("notes"),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_orders_code").on(table.orderCode),
    index("idx_orders_email").on(table.customerEmail),
    index("idx_orders_status").on(table.status),
    index("idx_orders_created").on(table.createdAt),
  ],
);

// =============================================================================
// ORDER ITEMS
// =============================================================================

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productName: varchar("product_name", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: integer("unit_price").notNull(),
    totalPrice: integer("total_price").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_order_items_order").on(table.orderId),
    index("idx_order_items_product").on(table.productId),
  ],
);

// =============================================================================
// INVENTORY ITEMS
// =============================================================================

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    encryptedPayload: bytea("encrypted_payload").notNull(),
    encryptionIv: bytea("encryption_iv").notNull(),
    encryptionTag: bytea("encryption_tag").notNull(),
    encryptionKeyId: varchar("encryption_key_id", { length: 50 })
      .notNull()
      .default("v1"),
    status: varchar("status", { length: 20 }).notNull().default("available"),
    orderItemId: uuid("order_item_id").references(() => orderItems.id, {
      onDelete: "set null",
    }),
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
    reservationExpiresAt: timestamp("reservation_expires_at", {
      withTimezone: true,
    }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_inventory_product_status").on(table.productId, table.status),
    index("idx_inventory_order_item").on(table.orderItemId),
    index("idx_inventory_reservation_expires").on(table.reservationExpiresAt),
  ],
);

// =============================================================================
// PAYMENTS
// =============================================================================

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    providerTxId: varchar("provider_tx_id", { length: 255 }),
    providerData: jsonb("provider_data").default({}),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedBy: uuid("confirmed_by").references(() => adminUsers.id),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_payments_order").on(table.orderId),
    index("idx_payments_provider_tx").on(table.providerTxId),
    index("idx_payments_status").on(table.status),
  ],
);

// =============================================================================
// DELIVERY EVENTS
// =============================================================================

export const deliveryEvents = pgTable(
  "delivery_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    deliveryToken: varchar("delivery_token", { length: 255 }).notNull().unique(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
    revealedAt: timestamp("revealed_at", { withTimezone: true }),
    revealedIp: inet("revealed_ip"),
    revealCount: integer("reveal_count").notNull().default(0),
    maxReveals: integer("max_reveals").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_delivery_token").on(table.deliveryToken),
    index("idx_delivery_order").on(table.orderId),
    index("idx_delivery_expires").on(table.tokenExpiresAt),
  ],
);

// =============================================================================
// AUDIT LOGS
// =============================================================================

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    details: jsonb("details").default({}),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_audit_admin").on(table.adminUserId),
    index("idx_audit_action").on(table.action),
    index("idx_audit_entity").on(table.entityType, table.entityId),
    index("idx_audit_created").on(table.createdAt),
  ],
);

// =============================================================================
// SECURITY EVENTS
// =============================================================================

export const securityEvents = pgTable(
  "security_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    severity: varchar("severity", { length: 20 }).notNull().default("info"),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    targetEmail: varchar("target_email", { length: 255 }),
    details: jsonb("details").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_security_event_type").on(table.eventType),
    index("idx_security_severity").on(table.severity),
    index("idx_security_ip").on(table.ipAddress),
    index("idx_security_created").on(table.createdAt),
  ],
);

// =============================================================================
// SETTINGS (key-value store for app configuration)
// =============================================================================

export const settings = pgTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// =============================================================================
// RELATIONS
// =============================================================================

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  sessions: many(adminSessions),
  auditLogs: many(auditLogs),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  user: one(adminUsers, {
    fields: [adminSessions.userId],
    references: [adminUsers.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  inventoryItems: many(inventoryItems),
  orderItems: many(orderItems),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  orderItems: many(orderItems),
  payments: many(payments),
  deliveryEvents: many(deliveryEvents),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  inventoryItems: many(inventoryItems),
}));

export const inventoryItemsRelations = relations(
  inventoryItems,
  ({ one, many }) => ({
    product: one(products, {
      fields: [inventoryItems.productId],
      references: [products.id],
    }),
    orderItem: one(orderItems, {
      fields: [inventoryItems.orderItemId],
      references: [orderItems.id],
    }),
    deliveryEvents: many(deliveryEvents),
  }),
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
  confirmedByUser: one(adminUsers, {
    fields: [payments.confirmedBy],
    references: [adminUsers.id],
  }),
}));

export const deliveryEventsRelations = relations(deliveryEvents, ({ one }) => ({
  order: one(orders, {
    fields: [deliveryEvents.orderId],
    references: [orders.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [deliveryEvents.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  adminUser: one(adminUsers, {
    fields: [auditLogs.adminUserId],
    references: [adminUsers.id],
  }),
}));
