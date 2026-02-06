# SECURE DIGITAL STORE — Implementation Plan

> **Project:** sug4r-shop — Public e-commerce storefront for digital goods (licensed accounts / subscription credentials)
> **Model:** Single seller, public buyers, protected admin panel
> **Date:** 2026-02-06
> **Status:** Phase 6 COMPLETE — Phase 7 next (Admin Dashboard + Customer Management + Logs)
> **Database:** Railway PostgreSQL (gondola.proxy.rlwy.net)

---

## A) Repo Discovery Report

### What Was Found

| Aspect | Finding |
|---|---|
| Directory | `C:\Projects\sug4r-shop` |
| Files | **Empty** — zero files, zero directories |
| Framework | None |
| Package manager | None |
| Styling | None |
| Auth | None |
| Database | None |
| Environment vars | None |
| Git | Not initialized |
| Deployment target | Unknown |

### Risks & Constraints from Discovery

- **Greenfield project** — no legacy code to preserve, but also no shortcuts.
- No `.gitignore` exists — must be created immediately to prevent committing secrets.
- Windows development environment — must ensure cross-platform scripts.
- No CI/CD pipeline — must be planned.

### Chosen Stack (Safe Defaults)

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15 App Router** | SSR + RSC + API routes, mature ecosystem |
| Language | **TypeScript (strict)** | Type safety across stack |
| Database | **PostgreSQL 16** | ACID, row-level locking, JSON support |
| ORM | **Drizzle ORM** | Type-safe, lightweight, supports pgcrypto |
| Styling | **Tailwind CSS 4 + shadcn/ui** | Rapid UI, accessible components |
| Auth | **Lucia v3** (session-based) | Simple, secure, no magic — explicit session management |
| Validation | **Zod** | Runtime schema validation, integrates with forms |
| Encryption | **Node.js `crypto` (AES-256-GCM)** | Built-in, no extra dependency, auditable |
| Payment | **Pluggable adapter** — Manual transfer first, Stripe adapter ready | Simplest safe default |
| Deployment | **Docker + any VPS / Vercel** | Flexible |

### Assumptions Made

1. PostgreSQL will be available locally (or via Docker) for development.
2. Admin is a single person; schema supports multiple admins for future-proofing.
3. No email transactional service is required initially — delivery is via secure link shown post-payment.
4. Node.js >= 20 LTS is available.
5. HTTPS is terminated at reverse proxy / hosting layer (Vercel / nginx).
6. Currency is single-currency (configurable via env var, default USD).

---

## B) Threat Model

### Assets

| Asset | Sensitivity | Storage |
|---|---|---|
| Admin credentials | CRITICAL | Hashed in DB (argon2id) |
| Admin session tokens | HIGH | Signed cookie (HttpOnly, Secure, SameSite=Lax) |
| Digital goods (account credentials / license keys) | CRITICAL | Encrypted at rest (AES-256-GCM), decrypted only at delivery time |
| Customer PII (email, order history) | MEDIUM | DB, protected by access control |
| Payment webhook secrets | HIGH | Env var, never committed |
| Database connection string | HIGH | Env var |
| Encryption master key | CRITICAL | Env var, never committed, rotation support |

### Threat → Mitigation Matrix

| # | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| T1 | Brute-force admin login | HIGH | CRITICAL | Rate limiting (IP + account), argon2id, optional TOTP 2FA, account lockout |
| T2 | SQL injection | MEDIUM | CRITICAL | Drizzle ORM parameterized queries, Zod input validation, no raw SQL |
| T3 | XSS (stored/reflected) | MEDIUM | HIGH | React auto-escaping, strict CSP, input sanitization, HttpOnly cookies |
| T4 | CSRF | MEDIUM | HIGH | SameSite=Lax cookies, CSRF token on state-changing POST, origin checking |
| T5 | Credential leakage (digital goods) | HIGH | CRITICAL | AES-256-GCM encryption at rest, view-once delivery, no plaintext logging |
| T6 | Privilege escalation | MEDIUM | CRITICAL | Server-side auth checks on every admin route/action, no client-side gates |
| T7 | Webhook spoofing (payment) | MEDIUM | HIGH | Signature verification (HMAC), idempotency keys, replay protection |
| T8 | IDOR (order/inventory access) | MEDIUM | HIGH | UUID primary keys, ownership checks, no sequential IDs exposed |
| T9 | Session hijack | MEDIUM | HIGH | Secure cookie flags, session rotation on auth, short expiry + sliding window |
| T10 | Inventory scraping / enumeration | LOW | MEDIUM | No inventory count exposed publicly, rate limiting on catalog API |
| T11 | SSRF | LOW | HIGH | No user-controlled URL fetching in app logic |
| T12 | Dependency supply chain | MEDIUM | HIGH | Lock file, minimal deps, npm audit in CI |
| T13 | Admin session fixation | LOW | HIGH | Regenerate session ID on login |
| T14 | Timing attacks on auth | LOW | MEDIUM | Constant-time comparison for tokens/passwords |
| T15 | Data exfiltration via logs | MEDIUM | HIGH | Redact PII and credentials from all log output |

---

## C) Target Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    INTERNET / CDN                        │
│                   (HTTPS termination)                    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              NEXT.JS APPLICATION SERVER                  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Public Pages │  │  Admin Pages │  │  API Routes   │  │
│  │  (RSC + CC)   │  │  (RSC + CC)  │  │  (Route       │  │
│  │              │  │  Auth-gated  │  │   Handlers)   │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│  ┌──────▼─────────────────▼───────────────────▼───────┐  │
│  │              SERVER ACTION LAYER                    │  │
│  │         (Zod validation + auth checks)             │  │
│  └────────────────────┬───────────────────────────────┘  │
│                       │                                  │
│  ┌────────────────────▼───────────────────────────────┐  │
│  │              DATA ACCESS LAYER (DAL)                │  │
│  │    Drizzle ORM · Transactions · Encryption utils   │  │
│  └────────────────────┬───────────────────────────────┘  │
│                       │                                  │
└───────────────────────┼──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│                   POSTGRESQL 16                           │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────────┐ │
│  │ products │ │inventory │ │  orders   │ │ audit_logs │ │
│  │          │ │ _items   │ │           │ │            │ │
│  └──────────┘ └──────────┘ └───────────┘ └────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Route Structure

```
app/
├── (public)/                     # Public route group
│   ├── layout.tsx                # Public layout (header, footer)
│   ├── page.tsx                  # Home / landing
│   ├── catalog/
│   │   └── page.tsx              # Product listing
│   ├── product/[slug]/
│   │   └── page.tsx              # Product detail
│   ├── checkout/
│   │   └── page.tsx              # Checkout flow
│   ├── order/[code]/
│   │   └── page.tsx              # Order status lookup
│   ├── delivery/[token]/
│   │   └── page.tsx              # View-once secret delivery
│   ├── faq/
│   │   └── page.tsx              # FAQ (MDX-driven)
│   ├── terms/
│   │   └── page.tsx              # Terms of service
│   ├── privacy/
│   │   └── page.tsx              # Privacy policy
│   └── refund-policy/
│       └── page.tsx              # Refund policy
│
├── admin/                        # Admin route group (auth-gated)
│   ├── layout.tsx                # Admin layout + auth check
│   ├── login/
│   │   └── page.tsx              # Admin login
│   ├── page.tsx                  # Dashboard (KPIs)
│   ├── products/
│   │   ├── page.tsx              # Product list
│   │   ├── new/page.tsx          # Create product
│   │   └── [id]/edit/page.tsx    # Edit product
│   ├── inventory/
│   │   ├── page.tsx              # Inventory list
│   │   └── import/page.tsx       # Bulk import
│   ├── orders/
│   │   ├── page.tsx              # Order list
│   │   └── [id]/page.tsx         # Order detail + fulfill
│   ├── customers/
│   │   └── page.tsx              # Customer list
│   ├── logs/
│   │   └── page.tsx              # Audit + security logs
│   └── settings/
│       └── page.tsx              # Payment config, delivery settings
│
├── api/
│   ├── webhooks/
│   │   └── payment/route.ts      # Payment webhook endpoint
│   └── delivery/[token]/route.ts # Secure delivery API
│
├── layout.tsx                    # Root layout (security headers)
├── not-found.tsx
└── error.tsx
```

### Server / Client Component Boundaries

| Component | Type | Reason |
|---|---|---|
| Product listing page | Server Component | SEO, no interactivity needed for initial render |
| Product detail page | Server Component | SEO, data fetch |
| Checkout form | Client Component | Interactive form, payment flow |
| Admin login form | Client Component | Interactive form |
| Admin dashboard | Server Component | Data fetch, charts rendered server-side |
| Admin data tables | Client Component | Sorting, filtering, pagination |
| Order status lookup | Client Component | Form submission + polling |
| Delivery reveal page | Client Component | One-time reveal interaction with confirmation |

### API Layer Pattern

- **Server Actions** for all form mutations (create/update/delete) — colocated with the page or in `src/actions/` directory.
- **Route Handlers** (`app/api/`) only for:
  - External webhook endpoints (payment providers)
  - Secure delivery token endpoint (stateless, token-validated)
- **No tRPC** — server actions + Zod validation is sufficient for this scale.
- Every server action and route handler performs its own auth check (no middleware-only gates).

### Data Access Layer

- All DB access goes through `src/db/` module.
- Drizzle ORM with explicit transactions for multi-step operations.
- Inventory reservation uses `SELECT ... FOR UPDATE` row locking within a transaction.
- Encryption/decryption utilities in `src/lib/crypto.ts` — never in client code.

---

## D) Data Model (DB Schema)

### Entity Relationship Overview

```
admin_users ──< audit_logs
admin_users ──< security_events

products ──< inventory_items
products ──< order_items

orders ──< order_items
orders ──< payments
orders ──< delivery_events

order_items ──< inventory_items (1:1 when fulfilled)

inventory_items ──< delivery_events (1:1 when delivered)
```

### Tables

#### `admin_users`

```sql
CREATE TABLE admin_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,               -- argon2id
  totp_secret     TEXT,                        -- encrypted, nullable (optional 2FA)
  totp_enabled    BOOLEAN NOT NULL DEFAULT false,
  role            VARCHAR(50) NOT NULL DEFAULT 'admin',  -- future: 'super_admin', 'viewer'
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Index: UNIQUE on email (implicit from constraint)
```

#### `admin_sessions`

```sql
CREATE TABLE admin_sessions (
  id          VARCHAR(255) PRIMARY KEY,        -- session token (random, 32+ bytes hex)
  user_id     UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Index: user_id
-- Index: expires_at (for cleanup)
```

#### `categories`

```sql
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) NOT NULL UNIQUE,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Index: slug (UNIQUE)
-- Index: sort_order
```

#### `products`

```sql
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) NOT NULL UNIQUE,
  description     TEXT,                        -- rich text / markdown
  short_desc      VARCHAR(500),
  image_url       VARCHAR(2048),
  price           INTEGER NOT NULL,            -- cents (e.g., 999 = $9.99)
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft | active | archived
  sort_order      INT NOT NULL DEFAULT 0,
  metadata        JSONB DEFAULT '{}',          -- flexible extra fields
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Index: slug (UNIQUE)
-- Index: status, sort_order
-- Index: category_id
```

#### `inventory_items`

```sql
CREATE TABLE inventory_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  encrypted_payload BYTEA NOT NULL,            -- AES-256-GCM encrypted credential/key
  encryption_iv    BYTEA NOT NULL,             -- 12-byte IV for GCM
  encryption_tag   BYTEA NOT NULL,             -- 16-byte auth tag
  encryption_key_id VARCHAR(50) NOT NULL DEFAULT 'v1', -- for key rotation
  status          VARCHAR(20) NOT NULL DEFAULT 'available',
                                               -- available | reserved | sold | revoked
  order_item_id   UUID REFERENCES order_items(id) ON DELETE SET NULL,
  reserved_at     TIMESTAMPTZ,
  reservation_expires_at TIMESTAMPTZ,
  sold_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Index: product_id, status (for available inventory lookup)
-- Index: order_item_id
-- Index: reservation_expires_at (for cleanup of expired reservations)
-- IMPORTANT: encrypted_payload is NEVER logged, NEVER sent to client except via delivery
```

#### `orders`

```sql
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code      VARCHAR(20) NOT NULL UNIQUE, -- human-readable (e.g., "ORD-A1B2C3")
  customer_email  VARCHAR(255) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                                               -- pending | paid | fulfilled | refunded | cancelled
  subtotal        INTEGER NOT NULL,            -- cents
  total           INTEGER NOT NULL,            -- cents
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  ip_address      INET,
  user_agent      TEXT,
  notes           TEXT,                        -- admin notes
  fulfilled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Index: order_code (UNIQUE)
-- Index: customer_email
-- Index: status
-- Index: created_at
```

#### `order_items`

```sql
CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name    VARCHAR(255) NOT NULL,       -- snapshot at time of purchase
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      INTEGER NOT NULL,            -- cents, snapshot
  total_price     INTEGER NOT NULL,            -- cents
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Index: order_id
-- Index: product_id
```

#### `payments`

```sql
CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method      VARCHAR(50) NOT NULL,    -- 'manual_transfer' | 'stripe' | etc.
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
                                               -- pending | confirmed | failed | refunded
  amount              INTEGER NOT NULL,        -- cents
  currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
  provider_tx_id      VARCHAR(255),            -- external transaction ID
  provider_data       JSONB DEFAULT '{}',      -- raw webhook data (redacted)
  confirmed_at        TIMESTAMPTZ,
  confirmed_by        UUID REFERENCES admin_users(id), -- for manual confirms
  idempotency_key     VARCHAR(255) UNIQUE,     -- prevent duplicate processing
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Index: order_id
-- Index: provider_tx_id
-- Index: idempotency_key (UNIQUE)
-- Index: status
```

#### `delivery_events`

```sql
CREATE TABLE delivery_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  delivery_token  VARCHAR(255) NOT NULL UNIQUE, -- random token for view-once link
  token_expires_at TIMESTAMPTZ NOT NULL,        -- e.g., 24 hours from creation
  revealed_at     TIMESTAMPTZ,                  -- null = not yet viewed
  revealed_ip     INET,
  reveal_count    INT NOT NULL DEFAULT 0,       -- should stay 0 or 1
  max_reveals     INT NOT NULL DEFAULT 1,       -- view-once by default
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Index: delivery_token (UNIQUE)
-- Index: order_id
-- Index: token_expires_at (for cleanup)
```

#### `audit_logs`

```sql
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action          VARCHAR(100) NOT NULL,       -- e.g., 'product.create', 'order.fulfill'
  entity_type     VARCHAR(50),                 -- e.g., 'product', 'order', 'inventory_item'
  entity_id       UUID,
  details         JSONB DEFAULT '{}',          -- redacted action details
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Index: admin_user_id
-- Index: action
-- Index: entity_type, entity_id
-- Index: created_at
-- IMPORTANT: details must NEVER contain plaintext credentials or passwords
```

#### `security_events`

```sql
CREATE TABLE security_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      VARCHAR(100) NOT NULL,       -- 'login.failed', 'login.success',
                                               -- 'rate_limit.hit', 'webhook.invalid_sig'
  severity        VARCHAR(20) NOT NULL DEFAULT 'info', -- info | warn | critical
  ip_address      INET,
  user_agent      TEXT,
  target_email    VARCHAR(255),                -- for login attempts (NOT password)
  details         JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Index: event_type
-- Index: severity
-- Index: ip_address
-- Index: created_at
```

### Encryption Approach

**Algorithm:** AES-256-GCM (authenticated encryption)

**Implementation:**

```typescript
// src/lib/crypto.ts — conceptual outline
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // 96-bit IV for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

// Key loaded from env: ENCRYPTION_KEY_V1 (64 hex chars = 32 bytes)
// Key ID stored alongside ciphertext for rotation support

export function encrypt(plaintext: string, keyId: string = 'v1'): EncryptedPayload {
  const key = getKeyById(keyId); // from env
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted, iv, tag, keyId };
}

export function decrypt(payload: EncryptedPayload): string {
  const key = getKeyById(payload.keyId);
  const decipher = createDecipheriv(ALGORITHM, key, payload.iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(payload.tag);
  return decipher.update(payload.encrypted) + decipher.final('utf8');
}
```

**Key Management:**

- Master encryption key stored in `ENCRYPTION_KEY_V1` env var (32 random bytes, hex-encoded).
- `encryption_key_id` column in `inventory_items` tracks which key version was used.
- **Rotation strategy:** Add `ENCRYPTION_KEY_V2` env var, update new items with `keyId: 'v2'`. Run a migration script to re-encrypt old items. Old key is kept until all items are rotated, then removed.
- Key MUST NOT be committed to source control, stored in logs, or sent to clients.

**Inventory Reservation (Anti-Double-Sell):**

```typescript
// Pseudocode for reservation within a Drizzle transaction
await db.transaction(async (tx) => {
  // 1. Lock an available inventory item for this product
  const item = await tx.execute(sql`
    SELECT id FROM inventory_items
    WHERE product_id = ${productId}
      AND status = 'available'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `);

  if (!item) throw new Error('OUT_OF_STOCK');

  // 2. Mark as reserved with expiration
  await tx.update(inventoryItems)
    .set({
      status: 'reserved',
      orderId: orderItemId,
      reservedAt: new Date(),
      reservationExpiresAt: addMinutes(new Date(), 15),
    })
    .where(eq(inventoryItems.id, item.id));
});
```

- A cron job (or scheduled server action) releases expired reservations back to `available`.
- `FOR UPDATE SKIP LOCKED` prevents deadlocks under concurrent checkout.

---

## E) UX / Pages

### Public Pages

#### Home (`/`)
- Hero section with tagline and CTA
- Featured products grid (active products, sorted)
- Trust signals (secure delivery badge, instant delivery)
- Category navigation

#### Catalog (`/catalog`)
- Product grid with category filter sidebar
- Sort by: price, newest, name
- Shows: product image, name, short description, price, "In Stock" badge
- No inventory count shown publicly (security: prevents scraping exact stock)

#### Product Detail (`/product/[slug]`)
- Product image, name, full description (markdown rendered)
- Price, availability indicator (In Stock / Out of Stock — boolean only)
- "Buy Now" button → checkout
- Related products (same category)

#### Checkout (`/checkout`)
- Minimal form: email (required), select product + quantity
- Order summary with total
- Payment method selection (manual transfer instructions / Stripe)
- Zod validation on all inputs
- On submit: creates order, reserves inventory, shows payment instructions or redirects to Stripe

#### Order Status (`/order/[code]`)
- Lookup by order code (from URL) + email verification
- Shows: order status, items, payment status
- If fulfilled: shows delivery link(s) for each item
- No login required — order code + email is the auth factor

#### Delivery (`/delivery/[token]`)
- View-once credential reveal page
- Shows warning: "This credential will only be shown ONCE. Copy it now."
- User must click "Reveal" button to decrypt and display
- After reveal: token is marked as used, cannot be viewed again
- If expired or already viewed: shows appropriate error

#### Policy Pages (`/faq`, `/terms`, `/privacy`, `/refund-policy`)
- Content loaded from MDX files in `content/` directory
- Rendered with consistent layout
- Editable without code changes

### Admin Pages

#### Login (`/admin/login`)
- Email + password form
- Optional TOTP 2FA step (if enabled for user)
- Rate-limited: 5 attempts per 15 minutes per IP, 10 per account
- Shows generic error "Invalid credentials" (no user enumeration)
- Lockout after threshold

#### Dashboard (`/admin`)
- KPI cards: Total revenue (today/week/month), Orders count, Pending orders, Low stock alerts
- Recent orders table (last 10)
- Recent security events (last 5)

#### Products (`/admin/products`)
- Data table: name, category, price, status, inventory count, actions
- Create / Edit forms with Zod validation
- Image URL input (external hosting assumed — no file upload initially)
- Status toggle (draft/active/archived)

#### Inventory (`/admin/inventory`)
- Data table: product name, status, created date, order link
- Filter by product, status
- Bulk import: textarea or CSV upload for credentials (one per line)
  - Each line encrypted individually on server before DB insert
  - Preview count before confirm
  - Audit logged

#### Orders (`/admin/orders`)
- Data table: order code, customer email, status, total, date, actions
- Order detail page:
  - Order info, items, payment history
  - "Mark as Paid" button (for manual transfers)
  - "Fulfill" button → assigns inventory items and generates delivery tokens
  - "Refund" button → marks as refunded, revokes inventory items
- All state changes audit-logged

#### Customers (`/admin/customers`)
- List of unique customer emails with order count, total spent
- Click to see order history for that email

#### Logs (`/admin/logs`)
- Two tabs: Audit Logs | Security Events
- Filterable by date range, action type, severity
- Paginated, newest first
- No delete capability (append-only)

#### Settings (`/admin/settings`)
- Payment configuration: enable/disable methods, bank transfer instructions, Stripe keys
- Delivery settings: token expiry duration, max reveals
- Site settings: store name, currency, contact email

---

## F) Security Checklist (Implementation-Level)

### HTTP Security Headers

Applied in `next.config.ts` and/or middleware:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-DNS-Prefetch-Control: off
```

### Cookie Security

- [x] `HttpOnly: true` — no JS access
- [x] `Secure: true` — HTTPS only
- [x] `SameSite: Lax` — CSRF protection
- [x] `Path: /` — scoped appropriately
- [x] `Max-Age` — short-lived (24h default, configurable)

### Session Strategy

- Random 32-byte session ID (hex-encoded, 64 chars)
- Stored in DB (`admin_sessions` table) with expiry
- Session rotated on login (new ID, old invalidated)
- Sliding window expiry (extended on activity)
- Single active session per admin (optional: configurable)
- Logout invalidates session in DB immediately

### Rate Limiting

| Endpoint | Limit | Window | Key |
|---|---|---|---|
| `POST /admin/login` | 5 requests | 15 min | IP address |
| `POST /admin/login` | 10 requests | 15 min | target email |
| `POST /api/webhooks/*` | 100 requests | 1 min | IP address |
| `POST /checkout` (order creation) | 10 requests | 15 min | IP address |
| `GET /delivery/[token]` | 10 requests | 15 min | IP address |
| All other API routes | 60 requests | 1 min | IP address |

Implementation: In-memory rate limiter (e.g., `Map` with sliding window) for MVP; Redis-backed for production scale.

### CAPTCHA / Turnstile

- Configurable via env var `TURNSTILE_ENABLED=true|false`
- If enabled, required on: checkout form, order lookup form
- NOT required on admin login (rate limiting + 2FA is sufficient)

### Input Validation

- Every server action and route handler validates input with Zod schemas
- Schemas defined in `src/schemas/` directory
- Database values are validated on read where needed (defense in depth)
- File upload restricted to CSV only (inventory import), validated server-side

### Logging Redaction Rules

**NEVER log:**
- Plaintext passwords or password hashes
- Decrypted credentials / license keys
- Full credit card numbers
- Session tokens
- Encryption keys

**ALWAYS redact in logs:**
- Email → show first 2 chars + `***@domain.com`
- IP addresses → logged for security events only, purged after 90 days
- Webhook payloads → strip sensitive fields before storing in `provider_data`

### Secrets Management

- All secrets via environment variables
- `.env.local` for development (git-ignored)
- `.env.example` with placeholder descriptions (committed)
- Production: secrets via hosting provider's secret manager
- Required secrets:
  - `DATABASE_URL`
  - `ENCRYPTION_KEY_V1`
  - `SESSION_SECRET` (for cookie signing)
  - `ADMIN_INITIAL_EMAIL` (for seed script)
  - `ADMIN_INITIAL_PASSWORD` (for seed script, used once)
  - `STRIPE_SECRET_KEY` (optional)
  - `STRIPE_WEBHOOK_SECRET` (optional)
  - `TURNSTILE_SECRET_KEY` (optional)

### Dependency Security

- `npm audit` in CI pipeline
- Renovate or Dependabot for automated updates
- Lock file committed (`package-lock.json`)
- Minimal dependencies — prefer built-in Node.js APIs

### Database Security

- Least-privilege DB user: `SELECT, INSERT, UPDATE, DELETE` on app tables only
- Separate migration user with `CREATE, ALTER, DROP` privileges
- No `SUPERUSER` or `CREATEDB` for app user
- Connection via SSL in production
- Regular backups (pg_dump, automated)

### Admin Hardening

- Optional IP allowlist via env var `ADMIN_ALLOWED_IPS` (comma-separated CIDRs)
- Optional TOTP 2FA (per admin user, stored encrypted)
- Account lockout after 10 failed attempts (30-minute lockout)
- Session invalidation on password change
- Magic link / passwordless login disabled by default

---

## G) Phased Implementation Plan

### Phase 0: Project Setup & Repository Alignment --- COMPLETED

**Goal:** Initialize the repository with the chosen stack, tooling, and configuration. Establish conventions.

**Tasks:**

- [x] Initialize git repository (`git init`)
- [x] Create `.gitignore` (Node, Next.js, env files, IDE files, OS files)
- [x] Initialize Next.js 16.1.6 project with App Router and TypeScript
- [x] Verify `package.json` scripts work (`dev`, `build`, `start`, `lint`)
- [x] Install core dependencies: drizzle-orm, postgres, zod, argon2, lucia, shadcn/ui, etc.
- [x] Install dev dependencies: drizzle-kit, tsx
- [x] Set up shadcn/ui + 14 components (button, input, label, card, table, dialog, badge, sonner, separator, dropdown-menu, tabs, form, textarea, select)
- [x] Create `drizzle.config.ts` pointing to `src/db/schema.ts`
- [x] Create `.env.example` with all required env vars
- [x] Create `.env.local` with dev values
- [x] Create full directory structure (app, db, lib, schemas, types, components, content)
- [x] Configure TypeScript strict mode
- [x] Add security headers in `next.config.ts` (CSP, HSTS, X-Frame-Options, etc.)
- [x] Create `src/middleware.ts` with security headers + admin IP allowlist
- [x] Create `src/lib/utils.ts`, `constants.ts`, `crypto.ts`, `rate-limit.ts`, `logger.ts`, `audit.ts`, `security-events.ts`, `format.ts`, `order-code.ts`
- [x] Create `src/lib/payments/` adapter pattern with manual_transfer implemented
- [x] Create Zod schemas (`auth.ts`, `product.ts`, `order.ts`, `inventory.ts`)
- [x] Create types (`src/types/index.ts`)
- [x] Create DB schema (11 tables) + seed script
- [x] Create MDX content files (FAQ, Terms, Privacy, Refund Policy)
- [x] Create placeholder pages (home, 404, error boundary)
- [x] Verify `npm run build` succeeds — clean compile, zero errors

**File Paths:**
- `.gitignore`
- `.env.example`
- `.env.local`
- `drizzle.config.ts`
- `next.config.ts`
- `tsconfig.json`
- `src/middleware.ts`
- `src/lib/utils.ts`
- `src/db/schema.ts` (empty initial)
- `src/db/index.ts`

**Acceptance Criteria:**
- `npm run dev` starts Next.js dev server
- `npm run build` produces a clean build
- ESLint passes with no errors
- Directory structure matches specification
- `.env.example` documents all expected variables
- Git repo initialized with clean first commit

---

### Phase 1: Database Schema + Migrations + Models --- COMPLETED

**Goal:** Define the complete database schema in Drizzle, generate and run migrations, seed initial admin user.

**Database:** Railway PostgreSQL 17.7 (`gondola.proxy.rlwy.net:52242/railway`)

**Tasks:**

- [x] Connect to Railway PostgreSQL (verified connection)
- [x] Define Drizzle schema for all 12 tables in `src/db/schema.ts` (admin_users, admin_sessions, categories, products, inventory_items, orders, order_items, payments, delivery_events, audit_logs, security_events, settings)
- [x] Define all foreign key relationships and Drizzle relations
- [x] Define all indexes (28 indexes total)
- [x] Custom `bytea` type for encrypted columns
- [x] Generate migration with `drizzle-kit generate` → `0000_sweet_blue_marvel.sql`
- [x] Review generated SQL migration (197 lines, correct)
- [x] Run migration with `drizzle-kit migrate` — all 12 tables created on Railway
- [x] Create `src/db/index.ts` — connection singleton with pooling (max 10)
- [x] Create `src/lib/crypto.ts` — AES-256-GCM encrypt/decrypt
- [x] Verify encryption roundtrip with real DB — encrypted credential inserted, read back, decrypted successfully, match confirmed
- [x] Create `src/db/seed.ts` — seeds admin user (argon2id), 5 categories, 3 sample products
- [x] Run seed script — admin user `admin@sug4r.shop` created
- [x] Verify admin password hash with argon2 — correct password PASS, wrong password correctly rejected
- [x] Generated real `ENCRYPTION_KEY_V1` (replaced zeroes)
- [x] `drizzle.config.ts` updated to load `.env.local` via dotenv
- [x] Build passes cleanly after all changes

**File Paths:**
- `src/db/schema.ts`
- `src/db/index.ts`
- `src/db/seed.ts`
- `src/db/migrations/` (generated)
- `src/lib/crypto.ts`
- `src/lib/crypto.test.ts`
- `drizzle.config.ts` (updated)
- `package.json` (updated scripts)

**Acceptance Criteria:**
- All 11 tables exist in PostgreSQL with correct columns, types, and constraints
- Foreign keys and indexes are in place
- Seed script creates admin user with hashed password
- `encrypt()` → `decrypt()` roundtrip works correctly
- Tampered ciphertext throws authentication error
- `drizzle-kit studio` shows all tables correctly

**Tests:**
- `crypto.test.ts`: encrypt/decrypt roundtrip, wrong key rejection, tampered data rejection, different IVs for same plaintext

---

### Phase 2: Admin Auth + Sessions + RBAC + Audit Logging --- COMPLETED

**Goal:** Implement secure admin authentication with session management, authorization middleware, and audit logging.

**Tasks:**

- [x] Configured Lucia v3 with Drizzle PostgreSQL adapter (`src/lib/auth.ts`)
  - Session cookie: `admin_session`, HttpOnly, Secure, SameSite=Lax
  - Session expiry: 24h configurable, sliding window
- [x] Created Zod schemas in `src/schemas/auth.ts` (loginSchema, totpSchema)
- [x] Created `src/lib/rate-limit.ts` — sliding window rate limiter with presets
- [x] Created `src/lib/audit.ts` — audit log writer with redaction
- [x] Created `src/lib/security-events.ts` — security event logger
- [x] Created `src/actions/auth.ts`:
  - `loginAction`: full 10-step flow (validate → rate limit IP+email → lookup → lockout check → active check → argon2 verify → failed attempt tracking → session create → audit log → redirect)
  - `logoutAction`: invalidate session → clear cookie → audit log → redirect
  - Account lockout after 10 failed attempts (30 min)
  - Generic "Invalid credentials" error (no user enumeration)
- [x] Created `src/lib/auth-guard.ts`:
  - `validateAdminSession()`: validates cookie, extends session, checks user active status
  - `requireAdmin()`: redirects to login if not authenticated
  - `getClientIp()`: extracts IP from headers
- [x] Middleware updated with security headers + admin IP allowlist
- [x] Created login page (`src/app/admin/login/page.tsx` + `login-form.tsx`):
  - Redirects to dashboard if already authenticated
  - Client component form with `useActionState`
  - Error display, loading state
- [x] Created admin layout structure:
  - `app/admin/layout.tsx` — passthrough (no auth)
  - `app/admin/(dashboard)/layout.tsx` — auth-gated with sidebar + header
  - Route group pattern prevents login page redirect loop
- [x] Created `src/app/admin/(dashboard)/page.tsx` — placeholder dashboard with KPI cards
- [x] Created `src/components/admin/sidebar.tsx` — 7-item navigation (Dashboard, Products, Inventory, Orders, Customers, Logs, Settings)
- [x] Created `src/components/admin/header.tsx` — admin email display + logout button
- [x] Verified: `/admin/login` returns 200 (renders login form)
- [x] Verified: `/admin` returns 307 → `/admin/login` when unauthenticated
- [x] Verified: security headers present in responses (CSP, HSTS, X-Frame-Options, etc.)
- [x] Build passes cleanly
- [x] Test: login with correct credentials → redirected to `/admin`
- [x] Test: login with wrong credentials → error message, security event logged
- [x] Test: exceed rate limit → blocked with appropriate message
- [x] Test: access `/admin` without session → redirected to `/admin/login`
- [x] Test: logout → session invalidated, redirected to login
- [x] Test: expired session → redirected to login
- [x] Test: multiple rapid login attempts → rate limit triggered, security event logged

**File Paths:**
- `src/lib/auth.ts`
- `src/lib/auth-guard.ts`
- `src/lib/rate-limit.ts`
- `src/lib/audit.ts`
- `src/lib/security-events.ts`
- `src/schemas/auth.ts`
- `src/actions/auth.ts`
- `src/app/admin/login/page.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`
- `src/components/admin/sidebar.tsx`
- `src/components/admin/header.tsx`
- `src/middleware.ts` (updated)

**Acceptance Criteria:**
- Admin can log in with seeded credentials
- Session cookie is HttpOnly, Secure, SameSite=Lax
- Rate limiting blocks after 5 failed attempts from same IP
- All login attempts (success/failure) are logged in `security_events`
- Admin actions are logged in `audit_logs`
- Accessing any `/admin/*` route without auth redirects to login
- Logout fully invalidates the session

---

### Phase 3: Public Storefront UI + Product Browse --- COMPLETED

**Goal:** Build the public-facing storefront with product catalog, category browsing, and product detail pages. All data from DB.

**Tasks:**

- [x] Created `src/app/(public)/layout.tsx` with public header + footer
- [x] Created `src/components/public/header.tsx` — sticky header with nav (Catalog, FAQ, Track Order)
- [x] Created `src/components/public/footer.tsx` — footer with policy links
- [x] Created `src/components/public/product-card.tsx` — image, name, price, stock badge
- [x] Created `src/app/(public)/page.tsx` — home page:
  - Hero section with CTA buttons
  - Trust badges (Instant Delivery, AES-256 Encrypted, View-Once Links)
  - Category shortcuts with product counts
  - Featured products grid (6 products)
- [x] Created `src/actions/products.ts` — data access layer:
  - `getActiveProducts(filters)`: category filter, sort, pagination, boolean stock check
  - `getProductBySlug(slug)`: single product with stock check
  - `getCategories()`: active categories with product counts
  - `getFeaturedProducts(limit)`: featured products
  - **Security: only boolean inStock, never inventory counts**
- [x] Created `src/app/(public)/catalog/page.tsx`:
  - Category pill filter, 4 sort options, pagination
  - Server-side rendering with search params
- [x] Created `src/app/(public)/product/[slug]/page.tsx`:
  - Product detail with image, description, price, stock badge
  - "Buy Now" CTA linking to checkout with product ID
  - `generateMetadata` for SEO (title, description, Open Graph)
  - Returns 404 for nonexistent slugs
- [x] Created `src/components/public/mdx-content.tsx` — markdown renderer for policy pages
- [x] Created 4 policy pages (FAQ, Terms, Privacy, Refund) rendering from `content/*.mdx`
- [x] Created placeholder pages for checkout and order lookup
- [x] All pages styled with Tailwind, responsive
- [x] Verified: all pages return correct HTTP codes (200 for valid, 404 for invalid)
- [x] Verified: products render from DB with correct prices
- [x] Verified: SEO metadata renders (title template pattern)
- [x] Verified: no inventory counts leak to client HTML
- [x] Build passes: 12 routes compiled successfully
- [x] Verify: no inventory counts leak to client
- [x] Verify: pages are server-rendered (check page source)
- [x] Verify: SEO metadata is correct

**File Paths:**
- `src/app/(public)/layout.tsx`
- `src/app/(public)/page.tsx`
- `src/app/(public)/catalog/page.tsx`
- `src/app/(public)/product/[slug]/page.tsx`
- `src/app/(public)/faq/page.tsx`
- `src/app/(public)/terms/page.tsx`
- `src/app/(public)/privacy/page.tsx`
- `src/app/(public)/refund-policy/page.tsx`
- `src/app/not-found.tsx`
- `src/app/error.tsx`
- `src/components/public/header.tsx`
- `src/components/public/footer.tsx`
- `src/components/public/product-card.tsx`
- `src/components/public/mdx-content.tsx`
- `src/actions/products.ts`
- `src/lib/format.ts`
- `content/faq.mdx`
- `content/terms.mdx`
- `content/privacy.mdx`
- `content/refund-policy.mdx`

**Acceptance Criteria:**
- Public pages render with real data from database
- Product listing shows correct prices, names, images
- Category filtering works
- Product detail shows availability as boolean (not count)
- MDX pages render policy content correctly
- All pages are responsive (mobile/tablet/desktop)
- No server errors or hydration mismatches
- SEO metadata present on product pages

---

### Phase 4: Admin Product & Inventory Management --- COMPLETED

**Goal:** Build admin CRUD for products and inventory management, including secure bulk import of credentials.

**Tasks:**

- [x] Create Zod schemas in `src/schemas/product.ts`:
  - `createProductSchema`
  - `updateProductSchema`
  - `createCategorySchema`
- [x] Create Zod schemas in `src/schemas/inventory.ts`:
  - `importInventorySchema` (product_id + array of credential strings)
- [x] Create `src/actions/admin/products.ts` — server actions:
  - `createProduct(formData)`: validate, insert, audit log
  - `updateProduct(id, formData)`: validate, update, audit log
  - `deleteProduct(id)`: soft delete (set status=archived), audit log
  - `toggleProductStatus(id, status)`: draft/active/archived, audit log
  - All actions: `requireAdmin()` check first
- [x] Create `src/actions/admin/categories.ts`:
  - `createCategory(formData)`
  - `updateCategory(id, formData)`
  - `deleteCategory(id)`: only if no products reference it
- [x] Create `src/actions/admin/inventory.ts`:
  - `importInventoryItems(productId, credentials[])`:
    1. `requireAdmin()`
    2. Validate input
    3. For each credential string: encrypt with `crypto.encrypt()`, insert into `inventory_items`
    4. Audit log: "inventory.import" with count (NOT the credentials)
    5. Return success count
  - `getInventoryItems(filters)`: list with pagination, no decrypted payloads
  - `revokeInventoryItem(id)`: mark as revoked, audit log
  - `getInventoryStats(productId)`: count by status (for admin dashboard)
- [x] Create `src/app/admin/products/page.tsx`:
  - Server component with data table
  - Columns: name, category, price, status, inventory count (available/total), actions
  - Action buttons: edit, toggle status
  - "New Product" button
  - Filters: status, category, sort
  - Pagination
- [x] Create `src/app/admin/products/new/page.tsx`:
  - Product creation form (client component)
  - Fields: name, slug (auto-generated from name), category (select), description (textarea), short description, image URL, price, status
  - Zod validation on submit
- [x] Create `src/app/admin/products/[id]/edit/page.tsx`:
  - Product edit form (pre-filled)
  - Same fields as create
  - Inventory stats sidebar
- [x] Create `src/app/admin/inventory/page.tsx`:
  - Data table: product filter, status filter
  - Columns: ID (truncated), product, status, key ID, created date
  - No "credential" column (encrypted data never displayed in list)
  - Revoke action for available/reserved items
  - Pagination
- [x] Create `src/app/admin/inventory/import/page.tsx`:
  - Select product dropdown
  - Textarea for credentials (one per line)
  - "Preview" shows count
  - "Import" button encrypts and stores
  - Success/error feedback
- [x] Create `src/app/admin/categories/page.tsx`:
  - Simple list + inline create/edit/delete
  - Auto-slug generation
  - Delete only when no products reference category
- [x] Create reusable admin table component `src/components/admin/data-table.tsx`:
  - Generic columns
  - Pagination
  - Uses shadcn table
- [x] Create `src/components/admin/product-form.tsx` — shared form for create/edit
- [x] Added Categories link to admin sidebar
- [x] Build passes: all 6 new routes compiled (18 total routes)
- [x] Verify: admin can create, edit, and archive products
- [x] Verify: admin can import inventory items (credentials encrypted in DB)
- [x] Verify: inventory list never shows decrypted credentials
- [x] Verify: all admin actions are audit-logged
- [x] Verify: non-admin access to admin actions returns 401/redirect

**File Paths:**
- `src/schemas/product.ts`
- `src/schemas/inventory.ts`
- `src/actions/admin/products.ts`
- `src/actions/admin/categories.ts`
- `src/actions/admin/inventory.ts`
- `src/app/admin/products/page.tsx`
- `src/app/admin/products/new/page.tsx`
- `src/app/admin/products/[id]/edit/page.tsx`
- `src/app/admin/inventory/page.tsx`
- `src/app/admin/inventory/import/page.tsx`
- `src/app/admin/categories/page.tsx`
- `src/components/admin/data-table.tsx`
- `src/components/admin/product-form.tsx`

**Acceptance Criteria:**
- Products can be created, edited, archived from admin UI
- Categories can be managed
- Credentials are encrypted before DB insert (verify with raw SQL query)
- Inventory list shows metadata only, never decrypted content
- Audit logs record all product/inventory changes
- Authorization checks prevent access without valid session

---

### Phase 5: Checkout + Order Creation + Payment Adapter + Webhook Verification --- COMPLETED

**Goal:** Implement the public checkout flow, order creation with inventory reservation, and pluggable payment processing.

**Tasks:**

- [x] Create Zod schemas in `src/schemas/order.ts`:
  - `checkoutSchema` (email, emailConfirm, product_id, quantity, paymentMethod)
  - `orderLookupSchema` (order_code, email)
- [x] Create `src/lib/order-code.ts`:
  - `generateOrderCode()`: generates human-readable order code (e.g., `ORD-A1B2C3`)
  - Uses crypto-safe random, alphanumeric, 6 chars after prefix
  - Excludes confusing characters (0/O, 1/I)
- [x] Design payment adapter interface in `src/lib/payments/types.ts`:
  - `PaymentAdapter`, `PaymentIntentResult`, `PaymentInstructions`, `WebhookEvent`
- [x] Create `src/lib/payments/manual-transfer.ts`:
  - Implements `PaymentAdapter`
  - `createPaymentIntent`: creates payment record with status=pending
  - `getPaymentInstructions`: returns bank transfer details
- [x] Create `src/lib/payments/stripe.ts` (stub):
  - Implements `PaymentAdapter`
  - Throws "not configured" errors until STRIPE_SECRET_KEY is set
  - TODO comments for full Stripe Checkout Session integration
- [x] Create `src/lib/payments/index.ts`:
  - `getPaymentAdapter(method: string): PaymentAdapter`
  - `getAvailablePaymentMethods()`
  - Registry pattern for adapters
- [x] Create `src/actions/checkout.ts`:
  - `createOrderAction(formData)`:
    1. Validate input with Zod
    2. Check rate limit (IP-based, 10 per 15 min)
    3. Verify product exists and is active
    4. Check inventory availability (boolean, no count leak)
    5. Transaction: create order → order items → reserve inventory (FOR UPDATE SKIP LOCKED) → create payment
    6. On failure: automatic rollback
    7. Return: order code + payment instructions
    8. Security event on error
- [x] Create `src/actions/order-lookup.ts`:
  - `lookupOrderAction(orderCode, email)`:
    1. Validate input with Zod
    2. Rate limit (60/min per IP)
    3. Find order by code + email match (generic error on mismatch)
    4. Return order status, items, payment status, delivery links
    5. No encrypted credentials in response
- [x] Create `src/app/(public)/checkout/page.tsx` + `checkout-form.tsx`:
  - Client component in Suspense boundary (useSearchParams)
  - Product selection pre-filled from ?product= query param
  - Email + confirm email
  - Quantity selector (1-10)
  - Order summary with live total
  - On success: order code display + payment instructions + track order link
- [x] Create `src/app/(public)/order/lookup/page.tsx` + `lookup-form.tsx`:
  - Client component in Suspense boundary
  - Order code + email form
  - Shows: order status, items, payment, delivery links
  - Status-specific messages (pending, paid, fulfilled)
  - Delivery links with view/revealed/expired states
- [x] Create `src/app/api/webhooks/payment/route.ts`:
  - POST handler with rate limiting (100/min)
  - Idempotency check (skip if already confirmed)
  - Stripe signature validation stub (rejects until implemented)
  - Security event logging for all paths
  - Returns appropriate HTTP status codes
- [x] Create `src/actions/admin/orders.ts`:
  - `getOrders(filters)`: paginated with status filter
  - `getOrderDetail(id)`: full order with items, payments, deliveries
  - `markOrderPaid(orderId)`: transaction — update order + confirm payment, audit log
  - `refundOrder(orderId)`: transaction — refund order + release inventory + invalidate delivery tokens, audit log
- [x] Create `src/app/admin/orders/page.tsx`:
  - Data table: order code, customer email (redacted), status badge, total, date
  - Status filter pills
  - Pagination
  - Click to view detail
- [x] Create `src/app/admin/orders/[id]/page.tsx`:
  - Order detail with items, payment history, deliveries
  - Action buttons: Mark as Paid (pending only), Refund (paid/fulfilled)
  - Sidebar with order info (code, dates, IP)
  - Delivery status tracking (revealed/pending/expired)
- [x] Create `src/actions/admin/maintenance.ts`:
  - `cleanupExpiredReservations()`: releases expired reserved items back to available
  - Audit logged with release count
- [x] Build passes: 21 routes compiled, zero errors

**File Paths:**
- `src/schemas/order.ts`
- `src/lib/order-code.ts`
- `src/lib/payments/types.ts`
- `src/lib/payments/manual-transfer.ts`
- `src/lib/payments/stripe.ts`
- `src/lib/payments/index.ts`
- `src/actions/checkout.ts`
- `src/actions/order-lookup.ts`
- `src/actions/admin/orders.ts`
- `src/actions/admin/maintenance.ts`
- `src/app/(public)/checkout/page.tsx`
- `src/app/(public)/order/[code]/page.tsx`
- `src/app/api/webhooks/payment/route.ts`
- `src/app/admin/orders/page.tsx`
- `src/app/admin/orders/[id]/page.tsx`

**Acceptance Criteria:**
- Complete checkout flow works end-to-end
- Inventory reservation prevents double-sell under concurrent requests
- Out-of-stock handled gracefully
- Order lookup requires matching email
- Admin can mark orders as paid / refunded
- Payment webhook verifies signatures
- Idempotency prevents duplicate processing
- Expired reservations are cleaned up

**Tests:**
- Order code generation: uniqueness, format
- Payment adapter interface: manual transfer flow
- Inventory reservation: concurrent access (simulate with two transactions)

---

### Phase 6: Inventory Fulfillment + Secure Delivery (View-Once Secrets)

**Goal:** Implement the fulfillment workflow that assigns inventory to orders and generates secure, view-once delivery links.

**Tasks:**

- [x] Create `src/lib/delivery.ts`:
  - `generateDeliveryToken()`: 32 random bytes, URL-safe base64 encoded
  - `createDeliveryEvent(orderId, inventoryItemId, expiresInHours)`:
    1. Generate token
    2. Insert into `delivery_events` with expiration
    3. Return token
  - `revealDelivery(token)`:
    1. Find delivery event by token
    2. Check: not expired, `reveal_count < max_reveals`
    3. If valid: decrypt inventory item payload, increment `reveal_count`, set `revealed_at`
    4. Return decrypted credential
    5. If invalid: return appropriate error (expired / already revealed / not found)
    6. All paths log security events
  - `revokeDeliveryToken(token)`: sets `max_reveals = 0`, effectively disabling it
- [x] Create `src/actions/admin/fulfillment.ts`:
  - `fulfillOrder(orderId)`:
    1. `requireAdmin()`
    2. Verify order is paid
    3. Begin transaction:
       a. For each order item (× quantity):
          - Find reserved inventory item (or reserve from available if not yet reserved)
          - Mark as `sold`
          - Generate delivery event with token
       b. Update order status to `fulfilled`
       c. Set `fulfilled_at` timestamp
    4. Audit log: "order.fulfilled"
    5. Return delivery tokens/links (for display to admin)
  - `getDeliveryLinks(orderId)`: returns delivery URLs (tokens) for an order
- [x] Create `src/app/(public)/delivery/[token]/page.tsx`:
  - Client component with reveal interaction
  - On load: check token validity (without revealing)
  - Show product name and warning text
  - "Reveal Credential" button
  - On click: call server action to decrypt and reveal
  - Display credential in a monospace box with "Copy to Clipboard" button
  - Show: "This credential has been revealed. It will not be shown again."
  - If already revealed or expired: show appropriate message
  - No browser back/refresh to re-reveal (server enforced)
- [x] Create `src/actions/delivery.ts`:
  - `checkDeliveryToken(token)`: returns validity status + product name (without revealing)
  - `revealDeliveryAction(token)`:
    1. Rate limit by IP
    2. Call `revealDelivery(token)` from lib
    3. Log security event
    4. Return decrypted credential (one-time)
- [x] Create `src/app/api/delivery/[token]/route.ts`:
  - Alternative REST endpoint for delivery (optional, for API consumers)
  - Same logic as server action
  - Rate limited
- [x] Update order lookup page to show delivery links when order is fulfilled
- [x] Update admin order detail to show delivery links and their status (revealed/pending/expired)
- [x] Create `src/actions/admin/maintenance.ts` (update):
  - `cleanupExpiredDeliveryTokens()`: marks expired tokens, logs for auditing
- [x] Verify: admin can fulfill a paid order
- [x] Verify: fulfillment assigns correct inventory items
- [x] Verify: delivery token reveals credential exactly once
- [x] Verify: second reveal attempt shows "already revealed"
- [x] Verify: expired token shows "expired"
- [x] Verify: credential is properly decrypted (not garbled)
- [x] Verify: delivery page does not leak credential in page source before reveal
- [x] Verify: copied credential matches original imported value
- [x] Verify: all delivery events are logged

**File Paths:**
- `src/lib/delivery.ts`
- `src/actions/admin/fulfillment.ts`
- `src/actions/delivery.ts`
- `src/app/(public)/delivery/[token]/page.tsx`
- `src/app/api/delivery/[token]/route.ts`
- `src/actions/admin/maintenance.ts` (updated)

**Acceptance Criteria:**
- Fulfillment assigns inventory and generates delivery tokens
- Delivery page reveals credential exactly once
- Second access shows "already revealed"
- Expired tokens are rejected
- Decrypted credential matches the originally imported plaintext
- Delivery page does not expose credential before explicit user action
- All delivery events have audit trail

**Tests:**
- Delivery token generation: randomness, URL-safety
- Reveal logic: success, already-revealed, expired, not-found
- Decryption: correct output, handles rotation key IDs

---

### Phase 7: Admin Dashboard + Customer Management + Logs

**Goal:** Complete the admin panel with dashboard KPIs, customer management, and log viewing.

**Tasks:**

- [ ] Create `src/actions/admin/dashboard.ts`:
  - `getDashboardKPIs()`:
    - Total revenue: today, this week, this month, all time
    - Order counts: by status
    - Pending orders count
    - Low stock alerts (products with < 5 available items)
    - Recent orders (last 10)
    - Recent security events (last 5)
- [ ] Update `src/app/admin/page.tsx` — full dashboard:
  - KPI cards row (revenue, orders, pending, alerts)
  - Recent orders table
  - Security events summary
  - Low stock alerts list
- [ ] Create KPI card component `src/components/admin/kpi-card.tsx`
- [ ] Create `src/actions/admin/customers.ts`:
  - `getCustomers(pagination)`: distinct emails with order count, total spent
  - `getCustomerOrders(email)`: orders for a specific email
- [ ] Create `src/app/admin/customers/page.tsx`:
  - Data table: email (partially redacted in display), order count, total spent, last order date
  - Click to view order history
- [ ] Create `src/app/admin/customers/[email]/page.tsx`:
  - Customer order history
  - Note: email is URL-encoded
- [ ] Create `src/actions/admin/logs.ts`:
  - `getAuditLogs(filters)`: paginated, filterable by action, date range, admin
  - `getSecurityEvents(filters)`: paginated, filterable by event type, severity, date range
- [ ] Create `src/app/admin/logs/page.tsx`:
  - Two tabs: Audit Logs | Security Events
  - Each tab: data table with filters
  - Audit logs columns: timestamp, admin, action, entity, details (truncated)
  - Security events columns: timestamp, type, severity, IP, details
  - Date range filter
  - Export to CSV button (optional)
- [ ] Create `src/app/admin/settings/page.tsx`:
  - Payment configuration:
    - Enable/disable manual transfer
    - Bank transfer instructions (textarea)
    - Stripe keys (masked input, server-validated)
  - Delivery settings:
    - Token expiry duration (hours)
    - Max reveals per token
  - Store settings:
    - Store name
    - Currency
    - Contact email
  - Save settings to DB or env-backed config
- [ ] Create `src/actions/admin/settings.ts`:
  - `getSettings()`: read current settings
  - `updateSettings(formData)`: validate and save, audit log
- [ ] Create settings storage: `src/db/schema.ts` — add `settings` table (key-value):
  ```sql
  CREATE TABLE settings (
    key   VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
- [ ] Verify: dashboard shows correct KPIs
- [ ] Verify: customer list shows unique emails with aggregates
- [ ] Verify: audit logs display correctly with filters
- [ ] Verify: security events display with severity highlighting
- [ ] Verify: settings save and load correctly

**File Paths:**
- `src/actions/admin/dashboard.ts`
- `src/actions/admin/customers.ts`
- `src/actions/admin/logs.ts`
- `src/actions/admin/settings.ts`
- `src/app/admin/page.tsx` (updated)
- `src/app/admin/customers/page.tsx`
- `src/app/admin/customers/[email]/page.tsx`
- `src/app/admin/logs/page.tsx`
- `src/app/admin/settings/page.tsx`
- `src/components/admin/kpi-card.tsx`
- `src/db/schema.ts` (add settings table)

**Acceptance Criteria:**
- Dashboard KPIs reflect actual data
- Customer list aggregates are correct
- Audit logs are complete and filterable
- Security events show all tracked events
- Settings persist across page reloads

---

### Phase 8: Security Hardening

**Goal:** Apply all remaining security measures: CSP refinement, rate limiting tuning, logging redaction, CSRF, and security testing.

**Tasks:**

- [ ] Review and refine Content-Security-Policy header:
  - Test with CSP evaluator tool
  - Add nonces for inline scripts if needed (Next.js script handling)
  - Ensure no `unsafe-eval`
  - Verify report-uri or report-to is configured (optional)
- [ ] Implement CSRF protection:
  - Verify SameSite=Lax covers all state-changing operations
  - Add Origin header check in middleware for POST/PUT/DELETE requests
  - Add CSRF token for any cross-origin form submissions (if applicable)
- [ ] Audit all server actions for authorization:
  - Create checklist of every server action and route handler
  - Verify each has `requireAdmin()` or appropriate auth check
  - Verify each validates input with Zod
  - Verify no action exposes encrypted data unnecessarily
- [ ] Audit all client components:
  - Verify no sensitive data in client component props
  - Verify no encryption keys or secrets in client bundle
  - Check `next build` output for accidental server code in client bundle
- [ ] Implement comprehensive log redaction:
  - Review all `console.log` / `console.error` calls
  - Replace with structured logger (`src/lib/logger.ts`)
  - Logger automatically redacts: emails, IPs, tokens, credentials
  - Verify no plaintext credentials appear in any log output
- [ ] Create `src/lib/logger.ts`:
  - Structured JSON logger
  - Redaction rules for sensitive fields
  - Log levels: debug, info, warn, error
  - Outputs to stdout (for container log collection)
- [ ] Harden rate limiter:
  - Review all rate limit configurations
  - Add rate limiting to any unprotected endpoints
  - Consider IP + fingerprint combination for stricter limiting
  - Document rate limit behavior for each endpoint
- [ ] Implement account lockout:
  - After 10 failed login attempts: lock account for 30 minutes
  - Admin unlock via direct DB (or separate recovery mechanism)
  - Log lockout events as CRITICAL security events
- [ ] Add optional TOTP 2FA:
  - `src/lib/totp.ts`: TOTP generation and verification
  - Admin settings page: enable/disable 2FA
  - QR code display for authenticator app setup
  - Verification step during login flow
  - Recovery codes (one-time use, stored encrypted)
- [ ] Implement IP allowlist for admin (optional):
  - Read `ADMIN_ALLOWED_IPS` from env
  - Check in middleware for `/admin/*` routes
  - Log blocked access attempts
- [ ] Security test: verify all security headers are present (automated check)
- [ ] Security test: verify no SQL injection possible (test with malicious inputs)
- [ ] Security test: verify XSS is mitigated (test with script injection in product names)
- [ ] Security test: verify IDOR protection (try accessing other orders without auth)
- [ ] Security test: verify rate limiting works under load
- [ ] Security test: verify session fixation is prevented
- [ ] Security test: verify cookie flags are correct
- [ ] Review dependency list: remove unnecessary packages, run `npm audit`
- [ ] Create `SECURITY.md` in repo root with responsible disclosure instructions

**File Paths:**
- `src/lib/logger.ts`
- `src/lib/totp.ts`
- `src/middleware.ts` (updated)
- `next.config.ts` (updated headers)
- `SECURITY.md`

**Acceptance Criteria:**
- CSP header blocks inline scripts from external sources
- All server actions have auth + validation
- No secrets in client bundle (verify with build analysis)
- Structured logger redacts sensitive data
- Account lockout works after threshold
- Optional 2FA can be enabled and used
- All security tests pass

---

### Phase 9: Observability + Error Handling + Polish

**Goal:** Add production observability, error handling, UI polish, and performance optimization.

**Tasks:**

- [ ] Add global error boundary (`src/app/error.tsx`):
  - User-friendly error page
  - Log error to structured logger
  - Do NOT expose stack trace to user
- [ ] Add loading states:
  - `src/app/(public)/catalog/loading.tsx`
  - `src/app/(public)/product/[slug]/loading.tsx`
  - `src/app/admin/*/loading.tsx` for each admin page
  - Skeleton components for data tables
- [ ] Add `src/app/(public)/catalog/not-found.tsx` — product not found
- [ ] Add toast notifications for admin actions (success/error feedback)
- [ ] Add confirmation dialogs for destructive actions (delete, refund, revoke)
- [ ] Optimize images:
  - Use Next.js `<Image>` component for product images
  - Configure `remotePatterns` in `next.config.ts`
- [ ] Add pagination component (`src/components/ui/pagination.tsx`)
- [ ] Performance: add appropriate `revalidate` / caching strategies
  - Static generation for policy pages
  - ISR for product catalog (revalidate every 60 seconds)
  - No caching for admin pages
  - No caching for order/delivery pages
- [ ] Add health check endpoint: `src/app/api/health/route.ts`
  - Returns 200 if app is running
  - Optionally checks DB connectivity
  - Does NOT expose internal details
- [ ] Add basic analytics tracking (optional, privacy-respecting):
  - Page view counts (server-side, stored in DB or simple counter)
  - No third-party analytics scripts by default
- [ ] Mobile responsiveness review:
  - Test all public pages on mobile viewport
  - Test admin pages on tablet viewport
  - Fix any layout issues
- [ ] Accessibility review:
  - Ensure proper heading hierarchy
  - Add aria labels to interactive elements
  - Test keyboard navigation
  - Ensure sufficient color contrast
- [ ] Verify: error pages display correctly
- [ ] Verify: loading states show during data fetching
- [ ] Verify: toast notifications work for admin actions
- [ ] Verify: health check returns 200

**File Paths:**
- `src/app/error.tsx` (updated)
- `src/app/(public)/catalog/loading.tsx`
- `src/app/(public)/product/[slug]/loading.tsx`
- `src/app/admin/*/loading.tsx`
- `src/app/api/health/route.ts`
- `src/components/ui/pagination.tsx`

**Acceptance Criteria:**
- No unhandled errors show raw stack traces to users
- Loading states provide visual feedback
- Admin actions have confirmation dialogs and toast feedback
- Health check endpoint works
- Mobile layouts are usable
- Basic accessibility standards met

---

### Phase 10: Deployment Runbook + Operational Playbook

**Goal:** Prepare for production deployment with documentation, scripts, and operational procedures.

**Tasks:**

- [ ] Create `Dockerfile`:
  - Multi-stage build (deps → build → runtime)
  - Non-root user
  - Minimal runtime image (node:20-alpine)
  - Health check instruction
- [ ] Create `docker-compose.yml` for local dev:
  - PostgreSQL service
  - App service (with volume mount for hot reload)
  - Environment variables from `.env.local`
- [ ] Create `docker-compose.prod.yml` for production reference:
  - PostgreSQL with persistent volume
  - App service with production build
  - Secrets via environment
- [ ] Create deployment documentation (added to this file's Runbook section)
- [ ] Create backup script `scripts/backup-db.sh`:
  - `pg_dump` to compressed file
  - Upload to configured storage (S3/local)
  - Rotation (keep last 30 days)
- [ ] Create restore script `scripts/restore-db.sh`
- [ ] Create admin password reset script `scripts/reset-admin-password.ts`:
  - CLI script that hashes a new password and updates the admin user
  - Requires direct DB access
- [ ] Create encryption key rotation script `scripts/rotate-encryption-key.ts`:
  - Re-encrypts all inventory items from old key to new key
  - Transactional (all or nothing)
  - Logs progress
- [ ] Add CI workflow (`.github/workflows/ci.yml`):
  - Lint check
  - Type check
  - Unit tests
  - Build verification
  - `npm audit` (fail on high/critical)
- [ ] Create `scripts/seed-production.ts`:
  - Creates initial admin user only
  - Reads credentials from env vars
  - Safe to run multiple times (idempotent)
- [ ] Final review: verify all env vars documented in `.env.example`
- [ ] Final review: verify `.gitignore` covers all sensitive files
- [ ] Final review: verify no secrets in source code (grep for patterns)
- [ ] Final review: verify `npm run build` produces clean production build

**File Paths:**
- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `scripts/backup-db.sh`
- `scripts/restore-db.sh`
- `scripts/reset-admin-password.ts`
- `scripts/rotate-encryption-key.ts`
- `scripts/seed-production.ts`
- `.github/workflows/ci.yml`

**Acceptance Criteria:**
- Docker build produces working image
- `docker-compose up` starts full dev environment
- Backup and restore scripts work
- Admin password reset works
- CI pipeline passes
- No secrets in repository

---

## H) Runbook

### Local Development Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd sug4r-shop

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your local values (see env vars list below)

# 4. Start PostgreSQL (via Docker or local install)
docker-compose up -d db
# OR: ensure PostgreSQL is running locally on port 5432

# 5. Create the database
createdb sug4r_shop_dev

# 6. Generate and run migrations
npm run db:generate
npm run db:migrate

# 7. Seed initial data (admin user + sample products)
npm run db:seed

# 8. Start the dev server
npm run dev

# 9. Access the app
# Public:  http://localhost:3000
# Admin:   http://localhost:3000/admin/login
```

### Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/sug4r_shop_dev` |
| `ENCRYPTION_KEY_V1` | Yes | 32-byte hex-encoded AES-256 key for credential encryption | `a]1b2c3d4...` (64 hex chars) |
| `SESSION_SECRET` | Yes | Random string for cookie signing (32+ chars) | `super-secret-random-string-here` |
| `ADMIN_INITIAL_EMAIL` | Seed only | Email for initial admin user | `admin@example.com` |
| `ADMIN_INITIAL_PASSWORD` | Seed only | Password for initial admin user (min 12 chars) | `ChangeMe!Secure123` |
| `NEXT_PUBLIC_SITE_NAME` | No | Store display name (default: "Digital Store") | `Sugar Shop` |
| `NEXT_PUBLIC_SITE_URL` | No | Public URL of the site | `https://shop.example.com` |
| `DEFAULT_CURRENCY` | No | Default currency code (default: USD) | `USD` |
| `SESSION_MAX_AGE_HOURS` | No | Admin session duration in hours (default: 24) | `24` |
| `DELIVERY_TOKEN_EXPIRY_HOURS` | No | Delivery link expiry in hours (default: 48) | `48` |
| `DELIVERY_MAX_REVEALS` | No | Max times a delivery can be revealed (default: 1) | `1` |
| `STRIPE_SECRET_KEY` | No | Stripe API secret key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret | `whsec_...` |
| `STRIPE_PUBLISHABLE_KEY` | No | Stripe publishable key | `pk_live_...` |
| `TURNSTILE_ENABLED` | No | Enable Cloudflare Turnstile CAPTCHA (default: false) | `true` |
| `TURNSTILE_SITE_KEY` | No | Turnstile site key | `0x...` |
| `TURNSTILE_SECRET_KEY` | No | Turnstile server secret | `0x...` |
| `ADMIN_ALLOWED_IPS` | No | Comma-separated CIDR ranges for admin access | `192.168.1.0/24,10.0.0.1/32` |
| `RATE_LIMIT_ENABLED` | No | Enable rate limiting (default: true) | `true` |
| `LOG_LEVEL` | No | Minimum log level (default: info) | `debug` |

### Generating Secure Keys

```bash
# Generate ENCRYPTION_KEY_V1 (32 random bytes, hex-encoded)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Production Deployment

```bash
# 1. Build the Docker image
docker build -t sug4r-shop:latest .

# 2. Set up production PostgreSQL
# - Use managed PostgreSQL (e.g., Supabase, Neon, RDS)
# - Create database and user with limited privileges
# - Enable SSL connections

# 3. Configure environment variables in your hosting provider
# - Set all required env vars (see table above)
# - Ensure ENCRYPTION_KEY_V1 and SESSION_SECRET are unique to production
# - Set NEXT_PUBLIC_SITE_URL to your production domain

# 4. Run migrations
DATABASE_URL=<prod-url> npm run db:migrate

# 5. Seed initial admin user
DATABASE_URL=<prod-url> ADMIN_INITIAL_EMAIL=<email> ADMIN_INITIAL_PASSWORD=<strong-password> npm run db:seed

# 6. Deploy
docker run -d --name sug4r-shop \
  --env-file .env.production \
  -p 3000:3000 \
  sug4r-shop:latest

# 7. Configure reverse proxy (nginx/Caddy) with:
# - HTTPS termination (Let's Encrypt)
# - Proxy to localhost:3000
# - Rate limiting at proxy level (additional layer)

# 8. Verify deployment
curl https://your-domain.com/api/health
```

### Backup & Restore

```bash
# Backup
./scripts/backup-db.sh
# Creates: backups/sug4r_shop_YYYYMMDD_HHMMSS.sql.gz

# Restore
./scripts/restore-db.sh backups/sug4r_shop_20260206_120000.sql.gz
# WARNING: This overwrites the current database!

# Recommended schedule: daily automated backups, 30-day retention
```

### Incident Response Quick Steps

#### Credential Leak (digital goods exposed)

1. **Immediately:** Revoke all delivery tokens for affected items
   ```sql
   UPDATE delivery_events SET max_reveals = 0
   WHERE inventory_item_id IN (<affected_ids>);
   ```
2. Identify scope: which inventory items were exposed
3. Mark affected items as `revoked`
4. Notify affected customers (if applicable)
5. Generate new credentials from the original provider
6. Import new credentials and fulfill replacement delivery
7. Review audit logs to determine how the leak occurred
8. Post-mortem: document and fix root cause

#### Suspicious Admin Login Activity

1. Check `security_events` for failed login patterns:
   ```sql
   SELECT * FROM security_events
   WHERE event_type = 'login.failed'
   ORDER BY created_at DESC LIMIT 50;
   ```
2. If brute force detected:
   - Verify rate limiting is active
   - Consider enabling IP allowlist temporarily
   - Change admin password immediately
   - Invalidate all sessions:
     ```sql
     DELETE FROM admin_sessions;
     ```
3. Enable 2FA if not already enabled
4. Review audit logs for any successful unauthorized access

#### Payment Webhook Spoofing Attempt

1. Check `security_events` for `webhook.invalid_sig` events:
   ```sql
   SELECT * FROM security_events
   WHERE event_type = 'webhook.invalid_sig'
   ORDER BY created_at DESC;
   ```
2. Verify webhook secret is correct and not leaked
3. Rotate webhook secret with payment provider
4. Update `STRIPE_WEBHOOK_SECRET` env var
5. Verify no fraudulent orders were created
6. If fraudulent orders exist: mark as cancelled, revoke inventory

#### Database Compromise

1. **Immediately:** Take the application offline
2. Rotate all secrets: `ENCRYPTION_KEY_V1`, `SESSION_SECRET`, `DATABASE_URL`
3. Restore from last known good backup
4. Re-encrypt all inventory items with new key
5. Force all admin password resets
6. Review database access logs
7. Identify attack vector and patch
8. Notify affected parties if customer PII was accessed

#### Admin Password Reset (Emergency)

```bash
# Run the password reset script with direct DB access
DATABASE_URL=<connection-string> npx tsx scripts/reset-admin-password.ts <admin-email> <new-password>
```

---

## Appendix: Key Design Decisions & Rationale

| Decision | Rationale |
|---|---|
| Session-based auth (not JWT) | Sessions can be instantly invalidated; JWTs cannot be revoked without extra infra |
| AES-256-GCM (not libsodium) | Node.js built-in `crypto` module, no native dependency issues |
| Drizzle (not Prisma) | Lighter, faster, closer to SQL, better for explicit transactions and `FOR UPDATE` |
| Server Actions (not tRPC) | Built into Next.js, less boilerplate, same type safety with Zod |
| View-once delivery (not email) | Reduces credential exposure surface; email is insecure at rest |
| In-memory rate limiter | Sufficient for single-server deployment; documented upgrade path to Redis |
| No file uploads for images | Reduces attack surface; external image hosting (Cloudflare Images, S3, etc.) |
| UUID primary keys (not serial) | Prevents enumeration attacks (IDOR), no guessable IDs |
| Price in cents (integer) | Avoids floating-point precision issues with currency |
| Monorepo (no separate API) | Simpler deployment, shared types, server components make BFF unnecessary |

---

*This document is the single source of truth for the sug4r-shop implementation. Each phase should be implemented sequentially and reviewed before moving to the next. Do NOT start coding until this plan is approved.*
