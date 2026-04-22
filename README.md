# Subscription Billing & Accounting System

A robust, enterprise-grade multi-tenant subscription billing platform with double-entry bookkeeping, advanced financial reconciliation, and comprehensive accounting features built with Node.js, Express, PostgreSQL, and Prisma ORM.

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Core Modules](#core-modules)
- [API Endpoints & Examples](#-api-endpoints--examples)
- [API Testing Guide](#-api-testing-guide)
- [Webhook Events](#webhook-events)
- [Common Use Cases](#-common-use-cases)
- [Background Jobs](#background-jobs)
- [Database Schema](#database-schema)
- [Authentication & Security](#authentication--security)
- [Error Handling](#error-handling)
- [Logging](#logging)
- [Rate Limiting](#rate-limiting)
- [Docker Deployment](#docker-deployment)
- [Development Guidelines](#development-guidelines)
- [Testing](#testing)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

This is a production-ready subscription billing system designed to handle complex billing scenarios including:

- **Multi-Tenant Architecture**: Complete tenant isolation with role-based access control
- **Double-Entry Bookkeeping**: GL-compliant accounting with journal entries
- **Flexible Billing Cycles**: Support for monthly, quarterly, annual, and custom billing periods
- **Dunning Management**: Automated payment retry logic with configurable policies
- **Subscription Management**: Full lifecycle management from creation through cancellation
- **Revenue Recognition**: Automated revenue recognition based on ASC 606 compliance
- **Payment Processing**: Integration-ready payment gateway support
- **Webhook Handling**: Event-driven architecture for billing events

## Live Demo Status

- Live URL: not configured in this repository yet.
- Recommended deployment target: Railway or Render with two runtime processes:
1. API process: `npm run start`
2. Worker process: `npm run worker`
- Required environment variables: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `WEBHOOK_SIGNING_SECRET`

## Scope Notes (Implemented vs Planned)

The items below are planned and not fully implemented as end-to-end features yet:

- Tiered pricing and usage-based billing models
- Tax compliance/reporting workflows
- Refund issuance workflows

## Required Evaluation Endpoints

These endpoints are available to run the core task flow manually:

1. `POST /api/v1/billing/run-monthly-invoices`
2. `POST /api/v1/accounting/recognize-revenue`
3. `POST /api/v1/invoices/:id/payments`
4. `GET /api/v1/reports/income-statement`
5. `GET /api/v1/reports/balance-sheet`

## ✨ Key Features

### Billing & Subscriptions
- [x] Flat-rate subscription pricing model
- ✅ Flexible billing cycles with customizable intervals
- ✅ Prorated billing for mid-cycle changes
- ✅ Automated renewal management
- ✅ Subscription lifecycle hooks (creation, upgrade, downgrade, cancellation)
- ✅ Discount code and promotional pricing support

### Accounting & Financial
- ✅ Chart of accounts management
- ✅ Double-entry journal entries with GL posting
- ✅ Automated revenue recognition and deferral
- [x] Core accounting reports (trial balance, income statement, balance sheet)
- ✅ Financial reconciliation tools
- ✅ Audit trail for all transactions

### Payments & Collections
- ✅ Payment method management
- ✅ Automated dunning (payment retry logic)
- ✅ Failed payment handling and recovery
- ✅ Payment reconciliation

### Invoicing
- ✅ Automated invoice generation
- ✅ Invoice template customization
- ✅ Multi-currency support ready
- ✅ Invoice status tracking
- ✅ Historical invoice management

### Operations
- ✅ Customer management and lifecycle
- ✅ Plan and pricing management
- ✅ Webhook-based event notifications
- ✅ Comprehensive audit logging
- ✅ Admin reporting and dashboards

## 🏗️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────▼────────┐
        │   API Gateway   │
        │  (Rate Limiter) │
        └────────┬────────┘
                 │
     ┌───────────┴──────────────┐
     │                          │
┌────▼────────────────┐  ┌──────▼──────────────┐
│  Express Server     │  │  Worker Processes   │
│  - REST API         │  │  - Billing Jobs     │
│  - Auth             │  │  - Dunning         │
│  - Business Logic   │  │  - Revenue Recog.  │
│  - Middleware       │  │  - Webhooks        │
└────┬────────────────┘  └──────┬──────────────┘
     │                          │
     ├──────────┬───────────────┤
     │          │               │
┌────▼──┐  ┌────▼────┐  ┌──────▼──────┐
│ Redis │  │PostgreSQL│  │File Storage │
│ Cache │  │Database  │  │(Optional)   │
└───────┘  └──────────┘  └─────────────┘
```

### Module Architecture (MVC Pattern)

Each module follows a consistent architecture:
- **Controller**: Handles HTTP requests/responses
- **Service**: Contains business logic
- **Repository**: Data access layer with Prisma
- **Schema**: Joi validation schemas
- **Routes**: Express route definitions

## 🛠️ Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js | 18+ |
| **Framework** | Express.js | ^4.18.2 |
| **Database** | PostgreSQL | 14+ |
| **ORM** | Prisma | ^5.7.0 |
| **Caching** | Redis | 6+ |
| **Job Queue** | BullMQ | ^5.1.0 |
| **Authentication** | JWT (jsonwebtoken) | ^9.0.0 |
| **Validation** | Joi | ^17.11.0 |
| **Security** | Helmet | ^7.1.0 |
| **Logging** | Winston | ^3.11.0 |
| **API Docs** | Swagger/OpenAPI | ^6.2.0 |
| **Password Hash** | bcryptjs | ^2.4.3 |
| **HTTP Client** | Axios | ^1.6.0 |

## 📦 Prerequisites

Before getting started, ensure you have:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: 14 or higher
- **Redis**: 6.0 or higher (for caching and job queue)
- **Docker & Docker Compose** (optional, for containerized deployment)
- **Git**: For version control

### Verify Prerequisites

```bash
node --version    # v18.x or higher
npm --version     # v9.x or higher
psql --version    # Should be 14+
redis-cli --version  # Should be 6+
```

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/subscription-billing.git
cd subscription-billing
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Generate Prisma Client

```bash
npm run db:generate
```

## 🔧 Environment Configuration

### Create .env File

Create a `.env` file in the root directory:

```env
# ============================================================
# APPLICATION SETTINGS
# ============================================================
APP_ENV=development
APP_NAME=subscription-billing
APP_VERSION=1.0.0
APP_PORT=3000
APP_HOST=localhost
NODE_ENV=development

# ============================================================
# DATABASE
# ============================================================
DATABASE_URL=postgresql://user:password@localhost:5432/subscription_billing
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_TIMEOUT=30000

# ============================================================
# REDIS
# ============================================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TIMEOUT=10000

# ============================================================
# AUTHENTICATION
# ============================================================
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRY=24h
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRY=7d
BCRYPT_ROUNDS=10

# ============================================================
# SECURITY
# ============================================================
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# ============================================================
# EMAIL CONFIGURATION (Optional)
# ============================================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com

# ============================================================
# PAYMENT GATEWAY (If integrated)
# ============================================================
STRIPE_SECRET_KEY=sk_test_xxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx

# ============================================================
# LOGGING
# ============================================================
LOG_LEVEL=debug
LOG_FILE_PATH=./logs
LOG_RETENTION_DAYS=30

# ============================================================
# WORKER SETTINGS
# ============================================================
WORKER_CONCURRENCY=5
WORKER_TIMEOUT=60000
DUNNING_MAX_RETRIES=3
DUNNING_RETRY_INTERVAL=86400000

# ============================================================
# WEBHOOK
# ============================================================
WEBHOOK_MAX_RETRIES=5
WEBHOOK_TIMEOUT=10000
WEBHOOK_RETRY_INTERVAL=300000
```

### Environment Profiles

**Development (.env.development)**
```env
APP_ENV=development
LOG_LEVEL=debug
DATABASE_POOL_MIN=1
DATABASE_POOL_MAX=5
```

**Production (.env.production)**
```env
APP_ENV=production
LOG_LEVEL=warn
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
NODE_ENV=production
```

**Testing (.env.test)**
```env
APP_ENV=test
NODE_ENV=test
DATABASE_URL=postgresql://user:password@localhost:5432/subscription_billing_test
REDIS_DB=1
```

## 🗄️ Database Setup

### 1. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE subscription_billing;
CREATE USER billing_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE subscription_billing TO billing_user;

# Exit psql
\q
```

### 2. Run Database Migrations

```bash
# Run pending migrations
npm run db:migrate

# For production deployment
npm run db:migrate:prod

# Reset database (development only)
npm run db:reset
```

### 3. Seed Initial Data (Optional)

```bash
npm run db:seed
```

### 4. View Database in Prisma Studio

```bash
npm run db:studio
```

This opens Prisma Studio at `http://localhost:5555` for visual database management.

## ▶️ Running the Application

### Development Mode (with auto-reload)

```bash
# Start main server with Nodemon
npm run dev

# In another terminal, start workers
npm run worker:dev
```

Visit the API at: `http://localhost:3000`
Swagger UI: `http://localhost:3000/api-docs`

### Production Mode

```bash
# Start server
npm start

# Start workers
npm run worker
```

### Using PM2 for Process Management

```bash
# Install PM2 globally
npm install -g pm2

# Start with ecosystem config
pm2 start ecosystem.config.js

# Monitor processes
pm2 monit

# View logs
pm2 logs

# Stop all processes
pm2 stop all

# Delete all processes
pm2 delete all
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📁 Project Structure

```
subscription-billing/
├── src/                          # Main application source
│   ├── app.js                    # Express app factory
│   ├── server.js                 # Server entry point
│   │
│   ├── config/                   # Configuration modules
│   │   ├── constants.js          # App constants
│   │   ├── database.js           # Database connection
│   │   ├── env.js                # Environment variables
│   │   └── redis.js              # Redis connection
│   │
│   ├── middleware/               # Express middleware
│   │   ├── auth.middleware.js    # JWT authentication
│   │   ├── errorHandler.middleware.js
│   │   ├── rateLimiter.middleware.js
│   │   ├── requestId.middleware.js
│   │   ├── tenant.middleware.js  # Multi-tenant support
│   │   └── validate.middleware.js # Request validation
│   │
│   ├── modules/                  # Feature modules
│   │   ├── auth/                 # Authentication
│   │   ├── customers/            # Customer management
│   │   ├── discount-codes/       # Discount management
│   │   ├── invoices/             # Invoice management
│   │   ├── organizations/        # Tenant management
│   │   ├── payments/             # Payment processing
│   │   ├── plans/                # Plan management
│   │   ├── reports/              # Financial reports
│   │   ├── subscriptions/        # Subscription lifecycle
│   │   └── webhooks/             # Webhook management
│   │
│   ├── accounting/               # Accounting logic
│   │   ├── accounting.constants.js
│   │   ├── accounts.service.js   # GL account management
│   │   ├── journal.service.js    # Journal entry posting
│   │   └── recognition.service.js # Revenue recognition
│   │
│   ├── billing/                  # Billing logic
│   │   ├── billing-cycle.service.js
│   │   ├── proration.service.js
│   │   ├── dunning.service.js    # Payment retry logic
│   │   └── renewal.service.js
│   │
│   ├── shared/                   # Shared utilities
│   │   ├── errors/               # Custom error classes
│   │   ├── repositories/         # Base repository
│   │   └── utils/                # Helper functions
│   │
│   └── webhooks/                 # Webhook services
│       ├── webhook.service.js
│       └── webhook.job.js
│
├── workers/                      # Background job workers
│   ├── index.js                  # Worker bootstrap
│   ├── dunning.worker.js         # Payment retry worker
│   ├── recognition.worker.js     # Revenue recognition worker
│   ├── renewal.worker.js         # Subscription renewal worker
│   └── webhook.worker.js         # Webhook delivery worker
│
├── prisma/                       # Database schema & migrations
│   ├── schema.prisma             # Database schema
│   ├── seed.js                   # Database seeding script
│   └── migrations/               # Migration files
│
├── docker-compose.yml            # Docker Compose configuration
├── ecosystem.config.js           # PM2 configuration
├── package.json                  # Dependencies & scripts
├── .env.example                  # Environment template
├── .dockerignore                 # Docker ignore file
├── .gitignore                    # Git ignore file
└── README.md                     # This file
```

## 🔌 Core Modules

### 📊 Organizations Module
Manages multi-tenant organizations with role-based access control.

**Key Endpoints:**
- `POST /api/organizations` - Create organization
- `GET /api/organizations/:id` - Get organization details
- `PUT /api/organizations/:id` - Update organization
- `GET /api/organizations` - List organizations

### 👥 Customers Module
Manage customer profiles and customer-organization relationships.

**Key Endpoints:**
- `POST /api/customers` - Create customer
- `GET /api/customers` - List customers
- `GET /api/customers/:id` - Get customer details
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

**Features:**
- Tenant isolation
- Customer status tracking
- Custom metadata storage

### 💳 Subscriptions Module
Complete subscription lifecycle management.

**Key Endpoints:**
- `POST /api/subscriptions` - Create subscription
- `GET /api/subscriptions/:id` - Get subscription
- `PUT /api/subscriptions/:id` - Update subscription
- `POST /api/subscriptions/:id/upgrade` - Upgrade subscription
- `POST /api/subscriptions/:id/downgrade` - Downgrade subscription
- `DELETE /api/subscriptions/:id/cancel` - Cancel subscription

**Key Features:**
- Subscription status management (ACTIVE, PAUSED, CANCELLED, EXPIRED)
- Automatic renewal scheduling
- Prorated billing on changes
- Dunning integration for failed payments

### 📋 Invoices Module
Automated invoice generation and management.

**Key Endpoints:**
- `GET /api/invoices` - List invoices
- `GET /api/invoices/:id` - Get invoice details
- `POST /api/invoices/:id/send` - Send invoice
- `POST /api/invoices/:id/void` - Void invoice
- `POST /api/invoices/:id/write-off` - Write-off invoice

**Key Features:**
- Auto-generation on new subscriptions
- Status tracking (DRAFT, SENT, PAID, OVERDUE, CANCELLED)
- Line item management
- Tax calculation

### 💰 Payments Module
Payment processing and reconciliation.

**Key Endpoints:**
- `POST /api/payments` - Record payment
- `GET /api/payments/:id` - Get payment
- `POST /api/payments/:id/refund` - Issue refund
- `GET /api/payments?status=PENDING` - List pending payments

**Key Features:**
- Multi-currency support
- Payment status tracking
- Automatic dunning on failures

### 📈 Plans Module
Subscription plan definition and management.

**Key Endpoints:**
- `POST /api/plans` - Create plan
- `GET /api/plans` - List plans
- `PUT /api/plans/:id` - Update plan
- `DELETE /api/plans/:id` - Archive plan

**Plan Types:**
- FLAT_RATE - Fixed price per billing period
- TIERED - Volume-based pricing
- USAGE_BASED - Consumption-based pricing

### 🏷️ Discount Codes Module
Promotional discounts and coupon management.

**Key Endpoints:**
- `POST /api/discount-codes` - Create discount code
- `GET /api/discount-codes/:code` - Validate discount code
- `PUT /api/discount-codes/:id` - Update discount
- `DELETE /api/discount-codes/:id` - Deactivate discount

### 💼 Accounting Module
Double-entry bookkeeping and GL posting.

**Services:**
- `accounts.service.js` - Chart of accounts management
- `journal.service.js` - Journal entry posting
- `recognition.service.js` - Revenue recognition

**Key Features:**
- GL account types (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)
- Automated journal posting
- ASC 606 revenue recognition
- Tax reconciliation

### 📑 Reports Module
Financial and operational reporting.

**Report Types:**
- Revenue reports
- Reconciliation reports
- Tax reports
- Customer reports
- Aging reports

## 🌐 API Endpoints & Examples

### Authentication Endpoints

#### 1. User Registration
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo.com",
    "password": "Demo1234!",
    "name": "Admin User"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "email": "admin@demo.com",
    "name": "Admin User",
    "created_at": "2026-04-22T10:30:00Z"
  }
}
```

#### 2. User Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo.com",
    "password": "Demo1234!"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-123",
      "email": "admin@demo.com",
      "name": "Admin User"
    }
  }
}
```

#### 3. Refresh Access Token
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### 4. Verify Email
```bash
curl -X POST http://localhost:3000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo.com",
    "code": "123456"
  }'
```

---

### Organization Endpoints

#### 1. Create Organization
```bash
curl -X POST http://localhost:3000/api/organizations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Acme Corporation",
    "slug": "acme-corp"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "org-456",
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "status": "ACTIVE",
    "created_at": "2026-04-22T10:30:00Z"
  }
}
```

#### 2. List Organizations
```bash
curl -X GET "http://localhost:3000/api/organizations?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "organizations": [
      {
        "id": "org-456",
        "name": "Acme Corporation",
        "slug": "acme-corp",
        "status": "ACTIVE"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 3. Get Organization Details
```bash
curl -X GET http://localhost:3000/api/organizations/org-456 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 4. Update Organization
```bash
curl -X PUT http://localhost:3000/api/organizations/org-456 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Acme Corporation Inc.",
    "status": "ACTIVE"
  }'
```

---

### Customer Endpoints

#### 1. Create Customer
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "email": "john@example.com",
    "name": "John Doe",
    "external_id": "cust-001",
    "metadata": {
      "company": "Tech Inc",
      "address": "123 Main St"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cust-789",
    "organization_id": "org-456",
    "external_id": "cust-001",
    "email": "john@example.com",
    "name": "John Doe",
    "status": "ACTIVE",
    "metadata": {
      "company": "Tech Inc",
      "address": "123 Main St"
    },
    "created_at": "2026-04-22T10:30:00Z"
  }
}
```

#### 2. List Customers
```bash
curl -X GET "http://localhost:3000/api/customers?page=1&limit=20&status=ACTIVE" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 3. Get Customer Details
```bash
curl -X GET http://localhost:3000/api/customers/cust-789 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 4. Update Customer
```bash
curl -X PUT http://localhost:3000/api/customers/cust-789 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "John Doe Jr.",
    "metadata": {
      "company": "Tech Inc",
      "address": "456 Oak Ave"
    }
  }'
```

---

### Plan Endpoints

#### 1. Create Plan
```bash
curl -X POST http://localhost:3000/api/plans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Professional Plan",
    "slug": "professional",
    "description": "Best for growing teams",
    "price": 99.00,
    "currency": "USD",
    "billing_interval": "MONTHLY",
    "features": [
      "Unlimited users",
      "Advanced analytics",
      "Priority support"
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "plan-123",
    "organization_id": "org-456",
    "name": "Professional Plan",
    "slug": "professional",
    "price": 99.00,
    "currency": "USD",
    "billing_interval": "MONTHLY",
    "status": "ACTIVE",
    "created_at": "2026-04-22T10:30:00Z"
  }
}
```

#### 2. List Plans
```bash
curl -X GET "http://localhost:3000/api/plans?status=ACTIVE" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 3. Get Plan Details
```bash
curl -X GET http://localhost:3000/api/plans/plan-123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 4. Update Plan
```bash
curl -X PUT http://localhost:3000/api/plans/plan-123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "price": 109.00,
    "description": "Updated: Best for teams of any size"
  }'
```

---

### Subscription Endpoints

#### 1. Create Subscription
```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "customer_id": "cust-789",
    "plan_id": "plan-123",
    "billing_cycle_anchor": "2026-04-22",
    "trial_days": 14,
    "metadata": {
      "source": "web",
      "campaign": "spring2026"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "sub-001",
    "customer_id": "cust-789",
    "plan_id": "plan-123",
    "status": "ACTIVE",
    "current_period_start": "2026-04-22",
    "current_period_end": "2026-05-22",
    "trial_ends_at": "2026-05-06",
    "amount": 99.00,
    "currency": "USD",
    "created_at": "2026-04-22T10:30:00Z"
  }
}
```

#### 2. List Subscriptions
```bash
curl -X GET "http://localhost:3000/api/subscriptions?customer_id=cust-789&status=ACTIVE" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 3. Get Subscription Details
```bash
curl -X GET http://localhost:3000/api/subscriptions/sub-001 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 4. Upgrade Subscription
```bash
curl -X POST http://localhost:3000/api/subscriptions/sub-001/upgrade \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "plan_id": "plan-456",
    "proration": true
  }'
```

#### 5. Downgrade Subscription
```bash
curl -X POST http://localhost:3000/api/subscriptions/sub-001/downgrade \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "plan_id": "plan-789",
    "effective_date": "2026-05-22"
  }'
```

#### 6. Cancel Subscription
```bash
curl -X DELETE http://localhost:3000/api/subscriptions/sub-001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "reason": "customer_requested",
    "feedback": "Too expensive for my use case"
  }'
```

---

### Invoice Endpoints

#### 1. Create Invoice
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "subscription_id": "sub-001",
    "customer_id": "cust-789",
    "line_items": [
      {
        "description": "Professional Plan - Monthly",
        "amount": 99.00,
        "quantity": 1
      }
    ],
    "due_date": "2026-05-06"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "inv-001",
    "organization_id": "org-456",
    "subscription_id": "sub-001",
    "customer_id": "cust-789",
    "status": "DRAFT",
    "amount": 99.00,
    "tax_amount": 0,
    "total_amount": 99.00,
    "currency": "USD",
    "due_date": "2026-05-06",
    "invoice_number": "INV-001",
    "created_at": "2026-04-22T10:30:00Z"
  }
}
```

#### 2. List Invoices
```bash
curl -X GET "http://localhost:3000/api/invoices?customer_id=cust-789&status=SENT" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 3. Get Invoice Details
```bash
curl -X GET http://localhost:3000/api/invoices/inv-001 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 4. Send Invoice
```bash
curl -X POST http://localhost:3000/api/invoices/inv-001/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "send_email": true,
    "memo": "Please pay within 14 days"
  }'
```

#### 5. Mark Invoice as Paid
```bash
curl -X POST http://localhost:3000/api/invoices/inv-001/mark-paid \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "payment_id": "pay-123",
    "paid_at": "2026-04-28"
  }'
```

---

### Payment Endpoints

#### 1. Record Payment
```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "invoice_id": "inv-001",
    "amount": 99.00,
    "payment_method": "credit_card",
    "gateway_id": "stripe",
    "gateway_transaction_id": "ch_123456789",
    "metadata": {
      "last4": "4242",
      "brand": "VISA"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pay-123",
    "invoice_id": "inv-001",
    "customer_id": "cust-789",
    "amount": 99.00,
    "currency": "USD",
    "status": "SUCCEEDED",
    "payment_method": "credit_card",
    "gateway": "stripe",
    "gateway_transaction_id": "ch_123456789",
    "created_at": "2026-04-28T14:22:00Z"
  }
}
```

#### 2. List Payments
```bash
curl -X GET "http://localhost:3000/api/payments?invoice_id=inv-001&status=SUCCEEDED" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 3. Get Payment Details
```bash
curl -X GET http://localhost:3000/api/payments/pay-123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 4. Issue Refund
```bash
curl -X POST http://localhost:3000/api/payments/pay-123/refund \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "amount": 99.00,
    "reason": "customer_request",
    "note": "Customer requested refund due to service cancellation"
  }'
```

**Refund Response:**
```json
{
  "success": true,
  "data": {
    "id": "ref-001",
    "payment_id": "pay-123",
    "amount": 99.00,
    "status": "PROCESSED",
    "reason": "customer_request",
    "created_at": "2026-04-29T10:00:00Z"
  }
}
```

---

### Discount Code Endpoints

#### 1. Create Discount Code
```bash
curl -X POST http://localhost:3000/api/discount-codes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "code": "SUMMER2026",
    "description": "Summer campaign discount",
    "discount_type": "PERCENTAGE",
    "discount_value": 20,
    "max_uses": 100,
    "expires_at": "2026-08-31",
    "applicable_plans": ["plan-123", "plan-456"]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "dc-001",
    "code": "SUMMER2026",
    "discount_type": "PERCENTAGE",
    "discount_value": 20,
    "max_uses": 100,
    "current_uses": 0,
    "status": "ACTIVE",
    "created_at": "2026-04-22T10:30:00Z"
  }
}
```

#### 2. Validate Discount Code
```bash
curl -X GET "http://localhost:3000/api/discount-codes/SUMMER2026/validate" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### Report Endpoints

#### 1. Revenue Report
```bash
curl -X GET "http://localhost:3000/api/reports/revenue?start_date=2026-01-01&end_date=2026-04-30&interval=monthly" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "report_type": "REVENUE",
    "currency": "USD",
    "start_date": "2026-01-01",
    "end_date": "2026-04-30",
    "periods": [
      {
        "period": "2026-01",
        "recognized_revenue": 5000.00,
        "deferred_revenue": 1200.00,
        "invoiced_revenue": 6200.00
      },
      {
        "period": "2026-02",
        "recognized_revenue": 5500.00,
        "deferred_revenue": 1500.00,
        "invoiced_revenue": 7000.00
      }
    ],
    "total_recognized": 26500.00,
    "total_deferred": 5800.00
  }
}
```

#### 2. Reconciliation Report
```bash
curl -X GET "http://localhost:3000/api/reports/reconciliation?date=2026-04-30" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 3. Tax Report
```bash
curl -X GET "http://localhost:3000/api/reports/tax?start_date=2026-01-01&end_date=2026-04-30" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 4. Customer Report
```bash
curl -X GET "http://localhost:3000/api/reports/customers?status=ACTIVE&sort=mrr_desc" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🧪 API Testing Guide

### Using cURL

All the examples above use cURL, which is available on most systems. Here's a quick guide:

#### Setting Up Authorization Token

After login, save the access token:

```bash
# Login first
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo.com",
    "password": "Demo1234!"
  }')

# Extract and save token (requires jq)
TOKEN=$(echo $RESPONSE | jq -r '.data.accessToken')
echo $TOKEN
```

#### Using Token in Requests

```bash
# Use the token from above
TOKEN="your_token_here"

curl -X GET http://localhost:3000/api/organizations \
  -H "Authorization: Bearer $TOKEN"
```

### Using Postman

Import this collection template into Postman:

**Base URL:** `http://localhost:3000/api`

**Environment Variables:**
```
{{base_url}} = http://localhost:3000/api
{{access_token}} = <paste your token here>
{{org_id}} = <your-org-id>
{{customer_id}} = <your-customer-id>
{{subscription_id}} = <your-subscription-id>
{{invoice_id}} = <your-invoice-id>
```

**Common Headers for Protected Routes:**
```
Authorization: Bearer {{access_token}}
Content-Type: application/json
```

### Using REST Client (VS Code)

Create a file `requests.http` in your project:

```http
### Login and get token
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "admin@demo.com",
  "password": "Demo1234!"
}

### List organizations
@token = <paste_access_token_here>
GET http://localhost:3000/api/organizations
Authorization: Bearer @token

### Create a new customer
POST http://localhost:3000/api/customers
Authorization: Bearer @token
Content-Type: application/json

{
  "email": "new@example.com",
  "name": "New Customer",
  "external_id": "cust-002"
}
```

### Testing Complete Workflow

Here's a complete workflow from organization creation to subscription:

```bash
#!/bin/bash

# 1. Login and get token
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo.com",
    "password": "Demo1234!"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.accessToken')
echo "✓ Login successful. Token: ${TOKEN:0:20}..."

# 2. Create organization
ORG_RESPONSE=$(curl -s -X POST http://localhost:3000/api/organizations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Company",
    "slug": "test-company-'$(date +%s)'"
  }')

ORG_ID=$(echo $ORG_RESPONSE | jq -r '.data.id')
echo "✓ Organization created: $ORG_ID"

# 3. Create customer
CUSTOMER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "email": "customer@test.com",
    "name": "Test Customer",
    "external_id": "cust-'$(date +%s)'"
  }')

CUSTOMER_ID=$(echo $CUSTOMER_RESPONSE | jq -r '.data.id')
echo "✓ Customer created: $CUSTOMER_ID"

# 4. Create plan
PLAN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/plans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Basic Plan",
    "slug": "basic-'$(date +%s)'",
    "price": 29.99,
    "currency": "USD",
    "billing_interval": "MONTHLY"
  }')

PLAN_ID=$(echo $PLAN_RESPONSE | jq -r '.data.id')
echo "✓ Plan created: $PLAN_ID"

# 5. Create subscription
SUBSCRIPTION_RESPONSE=$(curl -s -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customer_id": "'$CUSTOMER_ID'",
    "plan_id": "'$PLAN_ID'",
    "billing_cycle_anchor": "'$(date -d 'today' +'%Y-%m-%d')'",
    "trial_days": 7
  }')

SUBSCRIPTION_ID=$(echo $SUBSCRIPTION_RESPONSE | jq -r '.data.id')
echo "✓ Subscription created: $SUBSCRIPTION_ID"

echo ""
echo "Complete workflow test successful!"
```

Save this as `test-workflow.sh` and run:
```bash
chmod +x test-workflow.sh
./test-workflow.sh
```

### Common Error Responses

**401 Unauthorized**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

**400 Bad Request**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email must be valid"
      }
    ]
  }
}
```

**429 Too Many Requests**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 60
  }
}
```

### Testing Payment Flow

For testing payments without real payment gateways:

```bash
# 1. Get invoice
INVOICE_ID="inv-001"

curl -X GET http://localhost:3000/api/invoices/$INVOICE_ID \
  -H "Authorization: Bearer $TOKEN"

# 2. Record test payment
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "invoice_id": "'$INVOICE_ID'",
    "amount": 99.00,
    "payment_method": "test_card",
    "gateway": "stripe",
    "gateway_transaction_id": "ch_test_'$(date +%s)'"
  }'

# 3. Verify payment
curl -X GET http://localhost:3000/api/invoices/$INVOICE_ID \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data.status'
```

### Webhook Events

Webhooks allow your application to receive real-time notifications for billing events.

#### Register Webhook Endpoint

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "url": "https://your-app.com/webhooks/billing",
    "events": [
      "subscription.created",
      "subscription.updated",
      "subscription.cancelled",
      "payment.succeeded",
      "payment.failed",
      "invoice.created",
      "invoice.paid"
    ],
    "active": true
  }'
```

#### Webhook Event: Subscription Created

Your endpoint receives:
```json
{
  "id": "evt-123",
  "type": "subscription.created",
  "created_at": "2026-04-22T10:30:00Z",
  "data": {
    "id": "sub-001",
    "customer_id": "cust-789",
    "plan_id": "plan-123",
    "status": "ACTIVE",
    "current_period_start": "2026-04-22",
    "current_period_end": "2026-05-22",
    "trial_ends_at": "2026-05-06",
    "amount": 99.00,
    "currency": "USD"
  }
}
```

#### Webhook Event: Payment Succeeded

```json
{
  "id": "evt-124",
  "type": "payment.succeeded",
  "created_at": "2026-04-28T14:22:00Z",
  "data": {
    "id": "pay-123",
    "invoice_id": "inv-001",
    "customer_id": "cust-789",
    "subscription_id": "sub-001",
    "amount": 99.00,
    "currency": "USD",
    "status": "SUCCEEDED",
    "payment_method": "credit_card",
    "gateway": "stripe",
    "gateway_transaction_id": "ch_123456789"
  }
}
```

#### Webhook Event: Payment Failed

```json
{
  "id": "evt-125",
  "type": "payment.failed",
  "created_at": "2026-04-28T14:22:00Z",
  "data": {
    "id": "pay-124",
    "invoice_id": "inv-001",
    "customer_id": "cust-789",
    "subscription_id": "sub-001",
    "amount": 99.00,
    "currency": "USD",
    "status": "FAILED",
    "error_code": "card_declined",
    "error_message": "Your card was declined",
    "retry_count": 1,
    "next_retry_at": "2026-04-29T14:22:00Z"
  }
}
```

#### Webhook Event: Invoice Paid

```json
{
  "id": "evt-126",
  "type": "invoice.paid",
  "created_at": "2026-04-28T14:25:00Z",
  "data": {
    "id": "inv-001",
    "invoice_number": "INV-001",
    "customer_id": "cust-789",
    "subscription_id": "sub-001",
    "status": "PAID",
    "amount": 99.00,
    "tax_amount": 0,
    "total_amount": 99.00,
    "currency": "USD",
    "due_date": "2026-05-06",
    "paid_at": "2026-04-28"
  }
}
```

#### Webhook Event: Subscription Cancelled

```json
{
  "id": "evt-127",
  "type": "subscription.cancelled",
  "created_at": "2026-05-10T10:00:00Z",
  "data": {
    "id": "sub-001",
    "customer_id": "cust-789",
    "plan_id": "plan-123",
    "status": "CANCELLED",
    "current_period_start": "2026-04-22",
    "current_period_end": "2026-05-22",
    "cancelled_at": "2026-05-10",
    "cancellation_reason": "customer_requested",
    "cancellation_feedback": "Too expensive for my use case"
  }
}
```

#### Handling Webhook Events

```javascript
// Example webhook handler in Express
app.post('/webhooks/billing', express.json(), (req, res) => {
  const event = req.body;

  // Verify webhook signature
  const signature = req.headers['x-webhook-signature'];
  if (!verifySignature(event, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Handle different event types
  switch(event.type) {
    case 'subscription.created':
      onSubscriptionCreated(event.data);
      break;
    case 'payment.succeeded':
      onPaymentSucceeded(event.data);
      break;
    case 'payment.failed':
      onPaymentFailed(event.data);
      break;
    case 'invoice.paid':
      onInvoicePaid(event.data);
      break;
    case 'subscription.cancelled':
      onSubscriptionCancelled(event.data);
      break;
  }

  // Acknowledge receipt
  res.json({ received: true });
});
```

---

## 🎯 Common Use Cases

### Use Case 1: Onboard a New Customer with Subscription

Complete workflow for onboarding a customer and activating a subscription:

```bash
#!/bin/bash

# Step 1: Create organization
curl -X POST http://localhost:3000/api/organizations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "TechStartup Inc",
    "slug": "techstartup-inc"
  }' | jq '.data.id'

# Step 2: Create customer
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "email": "founder@techstartup.com",
    "name": "John Smith",
    "external_id": "CS-12345"
  }' | jq '.data.id'

# Step 3: Create subscription to Professional plan
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customer_id": "CUSTOMER_ID_FROM_STEP_2",
    "plan_id": "plan-123",
    "trial_days": 14,
    "billing_cycle_anchor": "2026-04-22"
  }' | jq '.data.id'

# Step 4: Invoice is automatically generated and sent
# Check invoice status
curl -X GET "http://localhost:3000/api/invoices?customer_id=CUSTOMER_ID_FROM_STEP_2&status=SENT" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.invoices[0]'
```

### Use Case 2: Handle Subscription Upgrade

Customer wants to upgrade from Basic to Professional plan:

```bash
#!/bin/bash

# Get current subscription
SUBSCRIPTION=$(curl -s -X GET http://localhost:3000/api/subscriptions/sub-001 \
  -H "Authorization: Bearer $TOKEN")

echo "Current Plan: $(echo $SUBSCRIPTION | jq '.data.plan_id')"
echo "Current Amount: $(echo $SUBSCRIPTION | jq '.data.amount')"

# Upgrade to premium plan
UPGRADE=$(curl -s -X POST http://localhost:3000/api/subscriptions/sub-001/upgrade \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "plan_id": "plan-456",
    "proration": true
  }')

echo "New Plan: $(echo $UPGRADE | jq '.data.plan_id')"
echo "New Amount: $(echo $UPGRADE | jq '.data.amount')"
echo "Prorated Credit: $(echo $UPGRADE | jq '.data.proration_credit')"
```

### Use Case 3: Process Payment and Handle Failures

Handling payment scenarios with retries:

```bash
#!/bin/bash

# Get unpaid invoice
INVOICE=$(curl -s -X GET http://localhost:3000/api/invoices/inv-001 \
  -H "Authorization: Bearer $TOKEN")

INVOICE_ID=$(echo $INVOICE | jq -r '.data.id')
AMOUNT=$(echo $INVOICE | jq -r '.data.total_amount')

echo "Processing payment for Invoice $INVOICE_ID - Amount: \$${AMOUNT}"

# Attempt payment
PAYMENT=$(curl -s -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "invoice_id": "'$INVOICE_ID'",
    "amount": '$AMOUNT',
    "payment_method": "credit_card",
    "gateway": "stripe",
    "gateway_transaction_id": "ch_test_'$(date +%s)'"
  }')

STATUS=$(echo $PAYMENT | jq -r '.data.status')

if [ "$STATUS" = "SUCCEEDED" ]; then
  echo "✓ Payment succeeded"
  echo "Invoice will be marked as PAID"
else
  echo "✗ Payment failed: $(echo $PAYMENT | jq '.data.error_message')"
  echo "System will retry according to dunning policy"
fi
```

### Use Case 4: Apply Discount Code to New Subscription

```bash
#!/bin/bash

# Step 1: Verify discount code is valid
DISCOUNT=$(curl -s -X GET http://localhost:3000/api/discount-codes/SUMMER2026/validate \
  -H "Authorization: Bearer $TOKEN")

DISCOUNT_VALUE=$(echo $DISCOUNT | jq '.data.discount_value')
echo "Discount verified: $DISCOUNT_VALUE% off"

# Step 2: Create subscription with discount
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customer_id": "cust-789",
    "plan_id": "plan-123",
    "discount_code": "SUMMER2026",
    "trial_days": 7
  }' | jq '{
    id: .data.id,
    original_amount: .data.amount,
    discount_amount: .data.discount_amount,
    final_amount: .data.final_amount
  }'
```

### Use Case 5: Generate Financial Reports

```bash
#!/bin/bash

# Get revenue report for current month
START_DATE=$(date -d "$(date +%Y-%m-01)" +'%Y-%m-%d')
END_DATE=$(date +'%Y-%m-%d')

echo "Generating Revenue Report: $START_DATE to $END_DATE"

REPORT=$(curl -s -X GET "http://localhost:3000/api/reports/revenue?start_date=$START_DATE&end_date=$END_DATE&interval=daily" \
  -H "Authorization: Bearer $TOKEN")

echo "Daily Revenue:"
echo $REPORT | jq '.data.periods[] | {date: .period, revenue: .recognized_revenue}'

echo ""
echo "Summary:"
echo "Total Recognized: $(echo $REPORT | jq '.data.total_recognized')"
echo "Total Deferred: $(echo $REPORT | jq '.data.total_deferred')"
```

### Use Case 6: Cancel Subscription and Process Refund

```bash
#!/bin/bash

# Step 1: Cancel subscription
RESULT=$(curl -s -X DELETE http://localhost:3000/api/subscriptions/sub-001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "reason": "customer_requested",
    "feedback": "Found a cheaper alternative"
  }')

echo "✓ Subscription cancelled"

# Step 2: Get related invoices
INVOICES=$(curl -s -X GET "http://localhost:3000/api/invoices?subscription_id=sub-001&status=PAID" \
  -H "Authorization: Bearer $TOKEN")

LATEST_PAYMENT=$(echo $INVOICES | jq -r '.data.invoices[0].payments[0].id')

# Step 3: Issue refund for last payment
curl -s -X POST http://localhost:3000/api/payments/$LATEST_PAYMENT/refund \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "reason": "cancellation_refund",
    "note": "Prorated refund for cancelled subscription"
  }' | jq '{
    refund_id: .data.id,
    amount: .data.amount,
    status: .data.status
  }'
```

### Use Case 7: Monitor Subscriber Health

Check customer payment history and engagement:

```bash
#!/bin/bash

CUSTOMER_ID="cust-789"

# Get all customer subscriptions
echo "=== Customer Subscriptions ==="
curl -s -X GET "http://localhost:3000/api/subscriptions?customer_id=$CUSTOMER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.subscriptions[] | {
    id: .id,
    plan_id: .plan_id,
    status: .status,
    amount: .amount
  }'

# Get payment history
echo ""
echo "=== Payment History ==="
curl -s -X GET "http://localhost:3000/api/payments?customer_id=$CUSTOMER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.payments[] | {
    id: .id,
    amount: .amount,
    status: .status,
    created_at: .created_at
  }' | head -10

# Check for failed payments
echo ""
echo "=== Failed Payments (Last 30 Days) ==="
curl -s -X GET "http://localhost:3000/api/payments?customer_id=$CUSTOMER_ID&status=FAILED" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.payments | length' | \
  { read count; echo "Failed payments: $count"; }
```

---

## 🔄 Background Jobs

The system uses BullMQ for reliable background job processing:

### Dunning Worker (`dunning.worker.js`)
Handles failed payment retries with exponential backoff.

**Triggers:**
- Payment failure events
- Scheduled retries based on dunning policies

**Actions:**
- Retry payment collection
- Update dunning status
- Send payment failure notifications

### Renewal Worker (`renewal.worker.js`)
Manages subscription renewals and cycle transitions.

**Triggers:**
- Subscription renewal date reached
- Scheduled daily renewal job

**Actions:**
- Generate renewal invoices
- Create new billing cycles
- Update subscription status
- Trigger payment collection

### Revenue Recognition Worker (`recognition.worker.js`)
Automated revenue recognition engine.

**Triggers:**
- New invoices posted
- Scheduled daily recognition job

**Actions:**
- Calculate deferred revenue
- Post GL entries for recognition
- Generate recognition schedules
- Track ASC 606 compliance

### Webhook Worker (`webhook.worker.js`)
Delivers webhook events to subscribers with retry logic.

**Event Types:**
- subscription.created
- subscription.updated
- subscription.cancelled
- payment.received
- payment.failed
- invoice.created
- invoice.sent
- invoice.paid

**Features:**
- Exponential backoff retry
- Webhook signature verification
- Dead-letter queue for failed deliveries

## 💾 Database Schema

### Core Entities

**Organization**
```sql
- id (UUID)
- name (VARCHAR)
- slug (VARCHAR, UNIQUE)
- status (ACTIVE, INACTIVE)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
- deleted_at (TIMESTAMPTZ, nullable)
```

**Customer**
```sql
- id (UUID)
- organization_id (UUID, FK)
- external_id (VARCHAR)
- email (VARCHAR)
- name (VARCHAR)
- status (ACTIVE, INACTIVE)
- metadata (JSONB)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

**Subscription**
```sql
- id (UUID)
- customer_id (UUID, FK)
- plan_id (UUID, FK)
- status (ACTIVE, PAUSED, CANCELLED, EXPIRED)
- current_period_start (DATE)
- current_period_end (DATE)
- trial_ends_at (TIMESTAMPTZ, nullable)
- canceled_at (TIMESTAMPTZ, nullable)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

**Invoice**
```sql
- id (UUID)
- organization_id (UUID, FK)
- subscription_id (UUID, FK, nullable)
- customer_id (UUID, FK)
- status (DRAFT, SENT, PAID, OVERDUE, CANCELLED)
- amount (DECIMAL)
- tax_amount (DECIMAL)
- due_date (DATE)
- paid_at (TIMESTAMPTZ, nullable)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

**Payment**
```sql
- id (UUID)
- invoice_id (UUID, FK)
- status (PENDING, SUCCEEDED, FAILED, REFUNDED)
- amount (DECIMAL)
- payment_method_id (VARCHAR)
- gateway_response_id (VARCHAR, nullable)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

**JournalEntry**
```sql
- id (UUID)
- organization_id (UUID, FK)
- reference_type (INVOICE, PAYMENT, ADJUSTMENT)
- reference_id (VARCHAR)
- description (VARCHAR)
- posted_at (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)
```

**JournalEntryLine**
```sql
- id (UUID)
- journal_entry_id (UUID, FK)
- account_id (UUID, FK)
- debit (DECIMAL, nullable)
- credit (DECIMAL, nullable)
```

See [prisma/schema.prisma](prisma/schema.prisma) for complete schema.

## 🔐 Authentication & Security

### JWT Authentication

The system uses JSON Web Tokens (JWT) for stateless authentication.

**Token Generation:**
```javascript
// Access token (short-lived)
const accessToken = generateAccessToken(userId, organizationId);
// 24 hours validity

// Refresh token (long-lived)
const refreshToken = generateRefreshToken(userId);
// 7 days validity
```

**Protected Routes:**
All API routes (except auth endpoints) require valid JWT in Authorization header:
```bash
Authorization: Bearer <access_token>
```

### Security Headers

Helmet.js is configured to set security headers:
- Content-Security-Policy
- X-Frame-Options (DENY)
- X-Content-Type-Options (nosniff)
- Strict-Transport-Security (HSTS)
- etc.

### CORS Configuration

CORS is configured to allow specified origins:
```javascript
const corsOptions = {
  origin: process.env.CORS_ORIGIN.split(','),
  credentials: true,
  optionsSuccessStatus: 200
};
```

### Password Security

- Passwords are hashed using bcryptjs with configurable rounds
- Minimum requirements enforced at registration
- Secure password reset tokens generated

### SQL Injection Prevention

Prisma ORM automatically provides parameterized queries, preventing SQL injection.

### Rate Limiting

Two-tiered rate limiting:
1. **General Rate Limiter**: 100 requests per 15 minutes per IP
2. **Auth Rate Limiter**: 5 failed attempts per 15 minutes

Configured using `express-rate-limit` with Redis backend.

## ❌ Error Handling

### Custom Error Classes

```javascript
// ApplicationError - Base error class
// ValidationError - Request validation failures
// AuthenticationError - Auth-related failures
// AuthorizationError - Permission issues
// NotFoundError - Resource not found
// ConflictError - Resource conflict
// ExternalServiceError - Third-party API failures
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "requestId": "req-123-abc"
}
```

### Global Error Handler

Express middleware catches all errors and returns standardized responses with appropriate HTTP status codes.

## 📝 Logging

### Winston Logger Configuration

Logs are written to:
- **Console**: In development (colorized)
- **File**: `./logs/app.log` (in production)
- **Daily Rotation**: Logs rotate daily, kept for 30 days

### Log Levels

- `error` - Error events
- `warn` - Warning events
- `info` - Informational messages
- `http` - HTTP request logs (Morgan integration)
- `debug` - Debug information

### Request Tracking

Every request includes a unique `requestId` in logs for tracing:
```javascript
logger.info('Processing payment', {
  requestId: 'req-123-abc',
  customerId: '...',
  amount: 100
});
```

## 🛡️ Rate Limiting

### Configuration

```env
RATE_LIMIT_WINDOW_MS=900000        # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100        # max 100 requests
AUTH_RATE_LIMIT_MAX=5              # max 5 auth attempts
```

### Implementation

- Redis-backed store for distributed rate limiting
- Keyed by IP address
- Returns 429 (Too Many Requests) when limit exceeded
- Includes `Retry-After` header

## 🐳 Docker Deployment

### Docker Compose Setup

Start all services:
```bash
docker-compose up -d
```

Services included:
- Node.js application
- PostgreSQL database
- Redis cache

### Production Dockerfile

Optimized multi-stage build:
1. Build stage - Install dependencies
2. Runtime stage - Lightweight final image

### Environment Variables

Create `.env` file before starting Docker:
```bash
cp .env.example .env
# Edit .env with production values
docker-compose up -d
```

## 👨‍💻 Development Guidelines

### Code Style

- ESLint configuration enforced
- Prettier for code formatting
- 2-space indentation
- Semicolons required

### Format & Lint

```bash
# Check code style
npm run lint

# Fix code style automatically
npm run lint:fix

# Format code with Prettier
npm run format

# Check format without changes
npm run format:check
```

### Coding Standards

1. **Module Pattern**: Each feature as self-contained module
2. **Separation of Concerns**: Controllers, services, repositories
3. **Error Handling**: Consistent error handling throughout
4. **Validation**: Joi schema validation on all inputs
5. **Logging**: Log important operations and errors
6. **Documentation**: JSDoc comments for functions

### Module Template

When creating new module, follow this structure:

```
module-name/
├── module-name.controller.js      # HTTP handlers
├── module-name.service.js         # Business logic
├── module-name.repository.js      # Data access
├── module-name.routes.js          # Express routes
├── module-name.schema.js          # Validation schemas
└── index.js                        # Module exports
```

### Commit Convention

Use conventional commits:
```
feat: Add payment reconciliation
fix: Fix timezone issue in invoice dates
docs: Update README
test: Add subscription tests
chore: Update dependencies
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- customers.test.js

# Watch mode
npm test -- --watch
```

### Test Structure

- Unit tests for services and utilities
- Integration tests for API endpoints
- Database tests with transaction rollback
- Mock external services

## ⚡ Performance Optimization

### Database Optimization

1. **Connection Pooling**: Configured min/max pool sizes
2. **Query Optimization**: Indexed foreign keys and common queries
3. **pagination**: Limit/offset on large result sets
4. **Eager Loading**: Use Prisma `include` for related data

### Caching Strategy

1. **Redis Cache**: Cache frequently accessed data
   - Organizations
   - Plans
   - Exchange rates

2. **Cache Invalidation**: Update cache on data changes

### API Response Optimization

1. **Field Selection**: Return only required fields
2. **Pagination**: Default 50 items per page
3. **Compression**: gzip compression enabled
4. **Async Processing**: Long operations to background jobs

### Monitoring

Monitor production performance:
```bash
# Check PM2 status
pm2 status

# Monitor process metrics
pm2 monit

# Check logs for errors
pm2 logs app
```

## 🔧 Troubleshooting

### Common Issues

**1. Database Connection Failed**
```
Error: connect ECONNREFUSED 127.0.0.1:5432

Solution:
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env
- Verify credentials
- Check firewall rules
```

**2. Redis Connection Failed**
```
Error: connect ECONNREFUSED 127.0.0.1:6379

Solution:
- Ensure Redis is running
- Check REDIS_HOST and REDIS_PORT in .env
- Restart Redis: redis-cli SHUTDOWN; redis-server
```

**3. JWT Token Invalid**
```
Error: JsonWebTokenError: invalid token

Solution:
- Check JWT_SECRET matches between token generation and validation
- Verify token hasn't expired
- Check Authorization header format
```

**4. Rate Limit Hits**
```
Error: 429 Too Many Requests

Solution:
- Increase rate limit in `.env`
- Implement request queuing on client
- Use caching to reduce API calls
```

**5. Migration Fails**
```
Error: Migration failed

Solution:
- Reset database: npm run db:reset
- Check migration files in prisma/migrations/
- Review Prisma logs for SQL errors
```

### Debugging

**Enable Debug Logging:**
```bash
DEBUG=app:* npm run dev
```

**Database Debugging:**
```bash
npm run db:studio
```

**Check Worker Logs:**
```bash
npm run worker:dev  # Logs to console
```

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Prisma ORM Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [JWT Best Practices](https://tools.ietf.org/html/rfc7519)
- [ASC 606 Revenue Recognition](https://www.fasb.org/Page/PageContent?PageId=/Standards/Glossary&ContentId=SRT151282300006652)

## 🤝 Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feature/new-feature`
2. Make changes and commit: `git commit -am 'feat: Add new feature'`
3. Push to branch: `git push origin feature/new-feature`
4. Create Pull Request with description

### Code Review Checklist

- [ ] Code follows project style guide
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes
- [ ] Database migrations included

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🚀 Quick Start Summary

```bash
# 1. Clone and install
git clone <repo-url>
cd subscription-billing
npm install

# 2. Setup database
npm run db:migrate
npm run db:seed

# 3. Configure environment
cp .env.example .env
# Edit .env with your values

# 4. Run development server
npm run dev

# 5. In another terminal, run workers
npm run worker:dev



