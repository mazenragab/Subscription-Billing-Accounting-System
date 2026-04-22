import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateImmediateProration,
  calculateNetProration,
} from '../src/billing/proration.service.js';

test('calculateNetProration detects upgrade with positive net amount', () => {
  const result = calculateNetProration({
    oldAmountCents: 10000,
    newAmountCents: 20000,
    currentDate: new Date('2026-04-15T00:00:00.000Z'),
    periodStart: new Date('2026-04-01T00:00:00.000Z'),
    periodEnd: new Date('2026-04-30T23:59:59.999Z'),
  });

  assert.equal(result.isUpgrade, true);
  assert.equal(result.isDowngrade, false);
  assert.ok(result.netAmountCents > 0);
});

test('calculateImmediateProration returns invoice line items when charge exists', () => {
  const result = calculateImmediateProration({
    oldAmountCents: 10000,
    newAmountCents: 15000,
    effectiveDate: new Date('2026-04-20T00:00:00.000Z'),
    periodStart: new Date('2026-04-01T00:00:00.000Z'),
    periodEnd: new Date('2026-04-30T23:59:59.999Z'),
  });

  assert.equal(result.shouldCreateInvoice, true);
  assert.ok(result.lineItems.length >= 1);
});
