import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInitialPeriod,
  calculateNextPeriod,
  canRenewSubscription,
} from '../src/billing/billing-cycle.service.js';

test('calculateInitialPeriod returns trial period when trial days exist', () => {
  const startDate = new Date(2026, 3, 1);

  const result = calculateInitialPeriod({
    startDate,
    anchorDay: 15,
    interval: 'MONTHLY',
    trialDays: 14,
  });

  assert.equal(result.trialStart.getFullYear(), 2026);
  assert.equal(result.trialStart.getMonth(), 3);
  assert.equal(result.trialStart.getDate(), 1);
  assert.equal(result.trialEnd.getFullYear(), 2026);
  assert.equal(result.trialEnd.getMonth(), 3);
  assert.equal(result.trialEnd.getDate(), 15);
  assert.ok(result.periodEnd > result.periodStart);
});

test('calculateNextPeriod moves to next cycle boundaries', () => {
  const currentPeriodEnd = new Date(2026, 3, 30, 23, 59, 59, 999);
  const result = calculateNextPeriod({
    currentPeriodEnd,
    anchorDay: 28,
    interval: 'MONTHLY',
  });

  assert.equal(result.periodStart.getFullYear(), 2026);
  assert.equal(result.periodStart.getMonth(), 4);
  assert.equal(result.periodStart.getDate(), 1);
  assert.ok(result.periodEnd > result.periodStart);
});

test('canRenewSubscription allows active/trialing and rejects cancelled', () => {
  assert.equal(
    canRenewSubscription({ status: 'ACTIVE', cancel_at_period_end: false }),
    true
  );
  assert.equal(
    canRenewSubscription({ status: 'TRIALING', cancel_at_period_end: false }),
    true
  );
  assert.equal(
    canRenewSubscription({ status: 'CANCELLED', cancel_at_period_end: false }),
    false
  );
  assert.equal(
    canRenewSubscription({ status: 'ACTIVE', cancel_at_period_end: true }),
    false
  );
});
