/**
 * Database seed script.
 *
 * Creates a demo organization with:
 *  - 1 owner user (admin@demo.com / Demo1234!)
 *  - billing_settings with sensible defaults
 *  - 4 system chart of accounts (Cash, AR, Deferred Revenue, Subscription Revenue)
 *  - Demo plans and discount codes
 *
 * Safe to run multiple times — uses upsert everywhere.
 *
 * Run: npm run db:seed
 */

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

// Account codes constants
const ACCOUNT_CODES = {
  CASH: '1100',
  ACCOUNTS_RECEIVABLE: '1200',
  DEFERRED_REVENUE: '2100',
  SUBSCRIPTION_REVENUE: '4100',
};

// Account types
const ACCOUNT_TYPES = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
};

// Normal balance types
const NORMAL_BALANCE = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
};

// User roles
const USER_ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  BILLING_MANAGER: 'BILLING_MANAGER',
  VIEWER: 'VIEWER',
};

// System accounts to seed
const SYSTEM_ACCOUNTS = [
  {
    code: ACCOUNT_CODES.CASH,
    name: 'Cash',
    type: ACCOUNT_TYPES.ASSET,
    normal_balance: NORMAL_BALANCE.DEBIT,
    description: 'Cash and cash equivalents received from customers',
  },
  {
    code: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    name: 'Accounts Receivable',
    type: ACCOUNT_TYPES.ASSET,
    normal_balance: NORMAL_BALANCE.DEBIT,
    description: 'Amounts owed by customers for issued invoices',
  },
  {
    code: ACCOUNT_CODES.DEFERRED_REVENUE,
    name: 'Deferred Revenue',
    type: ACCOUNT_TYPES.LIABILITY,
    normal_balance: NORMAL_BALANCE.CREDIT,
    description: 'Revenue received or invoiced but not yet earned',
  },
  {
    code: ACCOUNT_CODES.SUBSCRIPTION_REVENUE,
    name: 'Subscription Revenue',
    type: ACCOUNT_TYPES.REVENUE,
    normal_balance: NORMAL_BALANCE.CREDIT,
    description: 'Earned subscription revenue recognized after service delivery',
  },
];

async function main() {
  console.log('\n🌱 Starting database seed...\n');

  // ── 1. Demo organization ─────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo-org',
      status: 'ACTIVE',
    },
  });
  console.log(`✓ Organization: ${org.name} (${org.id})`);

  // ── 2. Billing settings ─────────────────────────────────────────────────
  const billingSettings = await prisma.billingSettings.upsert({
    where: { organization_id: org.id },
    update: {},
    create: {
      organization_id: org.id,
      currency: 'USD',
      timezone: 'UTC',
      invoice_prefix: 'INV',
      invoice_sequence: 0,
      journal_sequence: 0,
      payment_terms_days: 30,
      tax_rate_bps: 0,
      dunning_enabled: true,
      dunning_retry_days: [3, 7, 14],
    },
  });
  console.log('✓ Billing settings created');

  // ── 3. Owner user ────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo1234!', 12);
  const user = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      password_hash: passwordHash,
      name: 'Demo Admin',
      status: 'ACTIVE',
    },
  });
  console.log(`✓ User: ${user.email} (${user.id})`);

  // ── 4. User ↔ org role ───────────────────────────────────────────────────
  await prisma.userOrganizationRole.upsert({
    where: {
      user_id_organization_id: {
        user_id: user.id,
        organization_id: org.id,
      },
    },
    update: {},
    create: {
      user_id: user.id,
      organization_id: org.id,
      role: USER_ROLES.OWNER,
    },
  });
  console.log(`✓ Role: ${user.email} → ${USER_ROLES.OWNER}`);

  // ── 5. System chart of accounts ──────────────────────────────────────────
  console.log('\n📒 Seeding chart of accounts...');
  for (const account of SYSTEM_ACCOUNTS) {
    const created = await prisma.chartOfAccount.upsert({
      where: {
        organization_id_code: {
          organization_id: org.id,
          code: account.code,
        },
      },
      update: {},
      create: {
        organization_id: org.id,
        code: account.code,
        name: account.name,
        type: account.type,
        normal_balance: account.normal_balance,
        is_system: true,
        is_active: true,
        description: account.description,
      },
    });
    console.log(`  ✓ ${created.code} | ${created.name.padEnd(25)} | ${created.type} | Normal: ${created.normal_balance}`);
  }

  // ── 6. Demo plans ────────────────────────────────────────────────────────
  console.log('\n📦 Seeding demo plans...');
  const plans = [
    { name: 'Starter', amount_cents: 9900, currency: 'USD', interval: 'MONTHLY', trial_days: 14, sort_order: 1, is_active: true, is_public: true },
    { name: 'Professional', amount_cents: 29900, currency: 'USD', interval: 'MONTHLY', trial_days: 14, sort_order: 2, is_active: true, is_public: true },
    { name: 'Enterprise', amount_cents: 99900, currency: 'USD', interval: 'MONTHLY', trial_days: 0, sort_order: 3, is_active: true, is_public: true },
    { name: 'Pro Annual', amount_cents: 299900, currency: 'USD', interval: 'ANNUAL', trial_days: 14, sort_order: 4, is_active: true, is_public: true },
  ];

  for (const plan of plans) {
    const created = await prisma.plan.upsert({
      where: {
        organization_id_name: {
          organization_id: org.id,
          name: plan.name,
        },
      },
      update: {},
      create: {
        organization_id: org.id,
        ...plan,
      },
    });
    const dollars = (created.amount_cents / 100).toFixed(2);
    console.log(`  ✓ ${created.name.padEnd(15)} $${dollars}/${created.interval} | trial: ${created.trial_days}d`);
  }

  // ── 7. Demo discount codes ───────────────────────────────────────────────
  console.log('\n🏷️  Seeding demo discount codes...');
  const discountCodes = [
    { code: 'WELCOME10', type: 'PERCENTAGE', value: 1000, max_uses: 100, description: '10% off for new customers' },
    { code: 'SAVE20', type: 'PERCENTAGE', value: 2000, max_uses: 50, description: '20% off' },
    { code: 'FREESHIP', type: 'FIXED_AMOUNT', value: 5000, max_uses: 200, description: '$50 off' },
    { code: 'ANNUAL30', type: 'PERCENTAGE', value: 3000, max_uses: 30, description: '30% off annual plans' },
  ];

  for (const discount of discountCodes) {
    const created = await prisma.discountCode.upsert({
      where: {
        organization_id_code: {
          organization_id: org.id,
          code: discount.code,
        },
      },
      update: {},
      create: {
        organization_id: org.id,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        max_uses: discount.max_uses,
        is_active: true,
      },
    });
    console.log(`  ✓ ${created.code} | ${created.type} | ${created.value}${created.type === 'PERCENTAGE' ? 'bps' : ' cents'}`);
  }

  // ── 8. Demo customer ─────────────────────────────────────────────────────
  console.log('\n👥 Seeding demo customer...');
  const customer = await prisma.customer.upsert({
    where: {
      organization_id_email: {
        organization_id: org.id,
        email: 'customer@demo.com',
      },
    },
    update: {},
    create: {
      organization_id: org.id,
      name: 'Demo Customer',
      email: 'customer@demo.com',
      phone: '+1-555-123-4567',
      status: 'ACTIVE',
    },
  });
  console.log(`✓ Customer: ${customer.name} (${customer.email})`);

  // ── 9. Demo subscription ─────────────────────────────────────────────────
  console.log('\n📋 Seeding demo subscription...');
  
  // Get the Starter plan
  const starterPlan = await prisma.plan.findFirst({
    where: {
      organization_id: org.id,
      name: 'Starter',
    },
  });

  if (starterPlan) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(nextMonth.getDate() - 1);

    const subscription = await prisma.subscription.upsert({
      where: {
        id: 'demo-subscription',
      },
      update: {},
      create: {
        id: 'demo-subscription',
        organization_id: org.id,
        customer_id: customer.id,
        plan_id: starterPlan.id,
        status: 'ACTIVE',
        billing_anchor_day: today.getDate() > 28 ? 28 : today.getDate(),
        current_period_start: today,
        current_period_end: nextMonth,
        cancel_at_period_end: false,
      },
    });
    console.log(`✓ Subscription: ${subscription.id} | Plan: ${starterPlan.name}`);
  }

  // ── 10. Summary ──────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('Demo credentials:');
  console.log('  Email:    admin@demo.com');
  console.log('  Password: Demo1234!');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Organization ID: ${org.id}`);
  console.log(`User ID:         ${user.id}`);
  console.log(`Customer ID:     ${customer.id}`);
  console.log('─────────────────────────────────────────────────────────────');
  console.log('\n🚀 You can now test the API:\n');
  console.log('  # Login');
  console.log('  curl -X POST http://localhost:3000/api/v1/auth/login \\');
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"email":"admin@demo.com","password":"Demo1234!"}\'');
  console.log('\n  # List plans');
  console.log('  curl http://localhost:3000/api/v1/plans \\');
  console.log('    -H "Authorization: Bearer YOUR_TOKEN"');
  console.log('\n─────────────────────────────────────────────────────────────\n');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });