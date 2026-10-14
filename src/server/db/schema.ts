import { sql } from 'drizzle-orm'
import {
  
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core'
import type {AnyPgColumn} from 'drizzle-orm/pg-core';

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

// ── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['customer', 'admin', 'owner'])
export const preferModeEnum = pgEnum('prefer_mode', ['buy', 'rent', 'any'])
export const transactionModeEnum = pgEnum('transaction_mode', ['buy', 'rent', 'preorder'])
export const orderChannelEnum = pgEnum('order_channel', ['web', 'pos'])
export const orderStatusEnum = pgEnum('order_status', [
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'ready_pickup',
  'awaiting_stock',
  'rented',
  'returned',
  'completed',
  'cancelled',
  'expired',
  'refunded',
  'overdue',
])
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'refunded',
])
export const rentalUnitStatusEnum = pgEnum('rental_unit_status', [
  'available',
  'rented',
  'maintenance',
])
export const productEventTypeEnum = pgEnum('product_event_type', [
  'view',
  'add_cart',
  'favorite',
  'purchase',
])
export const attributeTypeEnum = pgEnum('attribute_type', ['text', 'enum', 'number', 'boolean'])
export const dictionaryKindEnum = pgEnum('dictionary_kind', ['synonym', 'tag', 'stopword'])

// ── Identitas ────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  phone: text('phone'),
  passwordHash: text('password_hash'),
  role: userRoleEnum('role').notNull().default('customer'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt,
  updatedAt,
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt,
  updatedAt,
})

export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt,
  updatedAt,
})

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt,
  updatedAt,
})

export const addresses = pgTable(
  'addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label'),
    recipient: text('recipient').notNull(),
    phone: text('phone').notNull(),
    street: text('street').notNull(),
    city: text('city').notNull(),
    province: text('province').notNull(),
    postalCode: text('postal_code').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt,
  },
  (t) => [index('addresses_user_idx').on(t.userId)],
)

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  categories: text('categories').array().notNull().default([]),
  budgetMin: integer('budget_min'),
  budgetMax: integer('budget_max'),
  partySize: integer('party_size'),
  conditions: text('conditions').array().notNull().default([]),
  style: text('style').array().notNull().default([]),
  preferMode: preferModeEnum('prefer_mode').notNull().default('any'),
  updatedAt,
})

// ── Katalog ──────────────────────────────────────────────────────────────────
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
  },
  (t) => [index('categories_parent_idx').on(t.parentId)],
)

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description').notNull().default(''),
    brandLine: text('brand_line'),
    salePrice: integer('sale_price').notNull(),
    discountPercent: integer('discount_percent').notNull().default(0),
    rentPricePerDay: integer('rent_price_per_day'),
    rentDeposit: integer('rent_deposit').notNull().default(0),
    isSellable: boolean('is_sellable').notNull().default(true),
    isRentable: boolean('is_rentable').notNull().default(false),
    isPreorder: boolean('is_preorder').notNull().default(false),
    preorderEta: timestamp('preorder_eta', { withTimezone: true }),
    preorderDpPercent: integer('preorder_dp_percent'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt,
  },
  (t) => [
    index('products_category_active_idx').on(t.categoryId, t.isActive),
    index('products_created_at_idx').on(t.createdAt),
    index('products_name_trgm_idx').using('gin', sql`name gin_trgm_ops`),
  ],
)

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull().unique(),
    colorName: text('color_name'),
    colorHex: text('color_hex'),
    size: text('size'),
    stock: integer('stock').notNull().default(0),
    salePriceOverride: integer('sale_price_override'),
  },
  (t) => [index('product_variants_product_idx').on(t.productId)],
)

export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id').references(() => productVariants.id, {
      onDelete: 'set null',
    }),
    r2Key: text('r2_key').notNull(),
    sort: integer('sort').notNull().default(0),
    alt: text('alt').notNull().default(''),
  },
  (t) => [index('product_images_product_idx').on(t.productId, t.sort)],
)

export const attributes = pgTable('attributes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  key: text('key').notNull().unique(),
  type: attributeTypeEnum('type').notNull().default('text'),
  allowedValues: jsonb('allowed_values').$type<Array<string | number | boolean>>(),
  weight: real('weight').notNull().default(1),
  isFilterable: boolean('is_filterable').notNull().default(true),
  showInSpec: boolean('show_in_spec').notNull().default(true),
})

export const productAttributeValues = pgTable(
  'product_attribute_values',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributes.id, { onDelete: 'cascade' }),
    value: jsonb('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.attributeId] })],
)

export const dictionaryTerms = pgTable('dictionary_terms', {
  id: uuid('id').primaryKey().defaultRandom(),
  term: text('term').notNull(),
  canonical: text('canonical').notNull(),
  kind: dictionaryKindEnum('kind').notNull().default('synonym'),
})

export const rentalUnits = pgTable(
  'rental_units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    serialCode: text('serial_code').notNull().unique(),
    condition: text('condition').notNull().default('good'),
    status: rentalUnitStatusEnum('status').notNull().default('available'),
  },
  (t) => [index('rental_units_variant_idx').on(t.variantId)],
)

// ── Interaksi ────────────────────────────────────────────────────────────────
export const favorites = pgTable(
  'favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.productId] }),
    index('favorites_user_idx').on(t.userId),
  ],
)

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    mode: transactionModeEnum('mode').notNull().default('buy'),
    qty: integer('qty').notNull().default(1),
    rentStart: timestamp('rent_start', { withTimezone: true }),
    rentEnd: timestamp('rent_end', { withTimezone: true }),
    createdAt,
  },
  (t) => [index('cart_items_user_idx').on(t.userId)],
)

export const productEvents = pgTable(
  'product_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    sessionId: text('session_id'),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    type: productEventTypeEnum('type').notNull(),
    createdAt,
  },
  (t) => [index('product_events_user_idx').on(t.userId, t.createdAt)],
)

export const productVectors = pgTable('product_vectors', {
  productId: uuid('product_id')
    .primaryKey()
    .references(() => products.id, { onDelete: 'cascade' }),
  vector: jsonb('vector').$type<number[]>().notNull(),
  version: integer('version').notNull().default(1),
  updatedAt,
})

export const productSimilarity = pgTable(
  'product_similarity',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    similarId: uuid('similar_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    score: doublePrecision('score').notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.similarId] })],
)

export const userProfileVectors = pgTable('user_profile_vectors', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  vector: jsonb('vector').$type<number[]>().notNull(),
  updatedAt,
})

// ── Transaksi ────────────────────────────────────────────────────────────────
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    channel: orderChannelEnum('channel').notNull().default('web'),
    type: transactionModeEnum('type').notNull(),
    status: orderStatusEnum('status').notNull().default('pending_payment'),
    subtotal: integer('subtotal').notNull().default(0),
    discount: integer('discount').notNull().default(0),
    shippingFee: integer('shipping_fee').notNull().default(0),
    depositTotal: integer('deposit_total').notNull().default(0),
    grandTotal: integer('grand_total').notNull().default(0),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
    midtransOrderId: text('midtrans_order_id'),
    trackingNo: text('tracking_no'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    shippingAddress: jsonb('shipping_address'),
    notes: text('notes'),
    createdAt,
  },
  (t) => [
    index('orders_user_created_idx').on(t.userId, t.createdAt),
    index('orders_status_idx').on(t.status),
  ],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    rentalUnitId: uuid('rental_unit_id').references(() => rentalUnits.id, {
      onDelete: 'set null',
    }),
    nameSnapshot: text('name_snapshot').notNull(),
    unitPrice: integer('unit_price').notNull(),
    qty: integer('qty').notNull().default(1),
    rentStart: timestamp('rent_start', { withTimezone: true }),
    rentEnd: timestamp('rent_end', { withTimezone: true }),
    rentDays: integer('rent_days'),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
)

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('midtrans'),
    grossAmount: integer('gross_amount').notNull(),
    status: paymentStatusEnum('status').notNull().default('pending'),
    rawNotification: jsonb('raw_notification'),
    signatureValid: boolean('signature_valid').notNull().default(false),
    createdAt,
  },
  (t) => [index('payments_order_idx').on(t.orderId)],
)

export const rentalReturns = pgTable('rental_returns', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderItemId: uuid('order_item_id')
    .notNull()
    .references(() => orderItems.id, { onDelete: 'cascade' }),
  returnedAt: timestamp('returned_at', { withTimezone: true }).notNull().defaultNow(),
  conditionNote: text('condition_note'),
  lateDays: integer('late_days').notNull().default(0),
  lateFee: integer('late_fee').notNull().default(0),
  damageFee: integer('damage_fee').notNull().default(0),
  depositRefund: integer('deposit_refund').notNull().default(0),
})

export const orderStatusLogs = pgTable(
  'order_status_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: orderStatusEnum('from_status'),
    toStatus: orderStatusEnum('to_status').notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt,
  },
  (t) => [index('order_status_logs_order_idx').on(t.orderId, t.createdAt)],
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    diff: jsonb('diff'),
    createdAt,
  },
  (t) => [index('audit_logs_created_idx').on(t.createdAt)],
)

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  email: text('email').primaryKey(),
  createdAt,
})
