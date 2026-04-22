import { createInvoice, generateNextInvoiceNumber, updateInvoiceStatus } from '../modules/invoices/invoices.repository.js';
import { createInvoiceJournalEntry } from '../accounting/journal.service.js';
import { createRecognitionSchedules } from '../accounting/recognition.service.js';

/**
 * Generate and issue a renewal invoice, then post accounting entries and recognition schedules.
 * Must be executed inside a Prisma transaction.
 *
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.subscriptionId - Subscription ID
 * @param {string} params.customerId - Customer ID
 * @param {string} params.customerName - Customer display name
 * @param {string} params.customerEmail - Customer email
 * @param {Object} params.plan - Plan object
 * @param {Date} params.periodStart - Billing period start
 * @param {Date} params.periodEnd - Billing period end
 * @param {Date} [params.issuedAt] - Invoice issue date
 * @param {string|null} [params.createdById] - Actor user ID
 * @param {Object} params.tx - Prisma transaction client
 * @param {string} [params.notes] - Optional invoice notes
 * @returns {Promise<Object>} Issued invoice
 */
export async function generateIssuedInvoiceForPeriod({
  organizationId,
  subscriptionId,
  customerId,
  customerName,
  customerEmail,
  plan,
  periodStart,
  periodEnd,
  issuedAt = new Date(),
  createdById = null,
  tx,
  notes = 'Auto-generated subscription invoice',
}) {
  const subtotalCents = plan.amount_cents;
  const invoiceNumber = await generateNextInvoiceNumber(organizationId, tx);

  const billingSettings = await tx.billingSettings.findUnique({
    where: { organization_id: organizationId },
    select: { payment_terms_days: true },
  });

  const paymentTermsDays = billingSettings?.payment_terms_days || 30;
  const dueAt = new Date(issuedAt.getTime() + (paymentTermsDays * 24 * 60 * 60 * 1000));

  const lineItemDescription = `${plan.name} (${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)})`;

  const invoice = await createInvoice(
    organizationId,
    {
      customer_id: customerId,
      subscription_id: subscriptionId,
      invoice_number: invoiceNumber,
      subtotal_cents: subtotalCents,
      discount_cents: 0,
      tax_cents: 0,
      total_cents: subtotalCents,
      currency: plan.currency || 'USD',
      period_start: periodStart,
      period_end: periodEnd,
      customer_name: customerName,
      customer_email: customerEmail,
      notes,
    },
    [
      {
        description: lineItemDescription,
        quantity: 1,
        unit_amount_cents: subtotalCents,
        amount_cents: subtotalCents,
        plan_id: plan.id,
        plan_name: plan.name,
        period_start: periodStart,
        period_end: periodEnd,
      },
    ],
    tx
  );

  const issuedInvoice = await updateInvoiceStatus(
    invoice.id,
    'ISSUED',
    {
      invoice_number: invoiceNumber,
      issued_at: issuedAt,
      due_at: dueAt,
    },
    tx
  );

  await createInvoiceJournalEntry({
    organizationId,
    invoiceId: issuedInvoice.id,
    totalCents: issuedInvoice.total_cents,
    createdById,
    tx,
  });

  await createRecognitionSchedules({
    organizationId,
    invoiceId: issuedInvoice.id,
    subscriptionId,
    periodStart,
    periodEnd,
    totalCents: issuedInvoice.total_cents,
    tx,
  });

  return issuedInvoice;
}

export default {
  generateIssuedInvoiceForPeriod,
};
