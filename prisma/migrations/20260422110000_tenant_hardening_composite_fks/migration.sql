-- Tenant hardening: enforce organization-scoped foreign keys at DB level.
-- This migration adds composite unique keys on parent tables and rewires child
-- relations to reference (organization_id, id) pairs.

-- 1) Add composite unique constraints on referenced parent tables.
CREATE UNIQUE INDEX "plans_organization_id_id_key" ON "plans"("organization_id", "id");
CREATE UNIQUE INDEX "discount_codes_organization_id_id_key" ON "discount_codes"("organization_id", "id");
CREATE UNIQUE INDEX "customers_organization_id_id_key" ON "customers"("organization_id", "id");
CREATE UNIQUE INDEX "customer_billing_info_organization_id_customer_id_key" ON "customer_billing_info"("organization_id", "customer_id");
CREATE UNIQUE INDEX "subscriptions_organization_id_id_key" ON "subscriptions"("organization_id", "id");
CREATE UNIQUE INDEX "invoices_organization_id_id_key" ON "invoices"("organization_id", "id");
CREATE UNIQUE INDEX "chart_of_accounts_organization_id_id_key" ON "chart_of_accounts"("organization_id", "id");
CREATE UNIQUE INDEX "journal_entries_organization_id_id_key" ON "journal_entries"("organization_id", "id");
CREATE UNIQUE INDEX "webhook_endpoints_organization_id_id_key" ON "webhook_endpoints"("organization_id", "id");

-- 2) Drop old single-column foreign keys that do not enforce tenant matching.
ALTER TABLE "customer_billing_info" DROP CONSTRAINT "customer_billing_info_customer_id_fkey";
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_customer_id_fkey";
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_plan_id_fkey";
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_pending_plan_id_fkey";
ALTER TABLE "subscription_discounts" DROP CONSTRAINT "subscription_discounts_subscription_id_fkey";
ALTER TABLE "subscription_discounts" DROP CONSTRAINT "subscription_discounts_discount_code_id_fkey";
ALTER TABLE "subscription_status_history" DROP CONSTRAINT "subscription_status_history_subscription_id_fkey";
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_customer_id_fkey";
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_subscription_id_fkey";
ALTER TABLE "invoice_line_items" DROP CONSTRAINT "invoice_line_items_invoice_id_fkey";
ALTER TABLE "payments" DROP CONSTRAINT "payments_invoice_id_fkey";
ALTER TABLE "payments" DROP CONSTRAINT "payments_customer_id_fkey";
ALTER TABLE "payments" DROP CONSTRAINT "payments_journal_entry_id_fkey";
ALTER TABLE "payment_attempts" DROP CONSTRAINT "payment_attempts_invoice_id_fkey";
ALTER TABLE "payment_attempts" DROP CONSTRAINT "payment_attempts_customer_id_fkey";
ALTER TABLE "payment_methods" DROP CONSTRAINT "payment_methods_customer_id_fkey";
ALTER TABLE "journal_entry_lines" DROP CONSTRAINT "journal_entry_lines_journal_entry_id_fkey";
ALTER TABLE "journal_entry_lines" DROP CONSTRAINT "journal_entry_lines_account_id_fkey";
ALTER TABLE "revenue_recognition_schedules" DROP CONSTRAINT "revenue_recognition_schedules_invoice_id_fkey";
ALTER TABLE "revenue_recognition_schedules" DROP CONSTRAINT "revenue_recognition_schedules_subscription_id_fkey";
ALTER TABLE "revenue_recognition_schedules" DROP CONSTRAINT "revenue_recognition_schedules_journal_entry_id_fkey";
ALTER TABLE "webhook_events" DROP CONSTRAINT "webhook_events_endpoint_id_fkey";

-- 3) Re-add tenant-safe composite foreign keys.
ALTER TABLE "customer_billing_info"
  ADD CONSTRAINT "customer_billing_info_org_customer_fkey"
  FOREIGN KEY ("organization_id", "customer_id")
  REFERENCES "customers"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_org_customer_fkey"
  FOREIGN KEY ("organization_id", "customer_id")
  REFERENCES "customers"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_org_plan_fkey"
  FOREIGN KEY ("organization_id", "plan_id")
  REFERENCES "plans"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_org_pending_plan_fkey"
  FOREIGN KEY ("organization_id", "pending_plan_id")
  REFERENCES "plans"("organization_id", "id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "subscription_discounts"
  ADD CONSTRAINT "subscription_discounts_org_subscription_fkey"
  FOREIGN KEY ("organization_id", "subscription_id")
  REFERENCES "subscriptions"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscription_discounts"
  ADD CONSTRAINT "subscription_discounts_org_discount_code_fkey"
  FOREIGN KEY ("organization_id", "discount_code_id")
  REFERENCES "discount_codes"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscription_status_history"
  ADD CONSTRAINT "subscription_status_history_org_subscription_fkey"
  FOREIGN KEY ("organization_id", "subscription_id")
  REFERENCES "subscriptions"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_org_customer_fkey"
  FOREIGN KEY ("organization_id", "customer_id")
  REFERENCES "customers"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_org_subscription_fkey"
  FOREIGN KEY ("organization_id", "subscription_id")
  REFERENCES "subscriptions"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoice_line_items"
  ADD CONSTRAINT "invoice_line_items_org_invoice_fkey"
  FOREIGN KEY ("organization_id", "invoice_id")
  REFERENCES "invoices"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_org_invoice_fkey"
  FOREIGN KEY ("organization_id", "invoice_id")
  REFERENCES "invoices"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_org_customer_fkey"
  FOREIGN KEY ("organization_id", "customer_id")
  REFERENCES "customers"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_org_journal_entry_fkey"
  FOREIGN KEY ("organization_id", "journal_entry_id")
  REFERENCES "journal_entries"("organization_id", "id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_org_invoice_fkey"
  FOREIGN KEY ("organization_id", "invoice_id")
  REFERENCES "invoices"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_org_customer_fkey"
  FOREIGN KEY ("organization_id", "customer_id")
  REFERENCES "customers"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_methods"
  ADD CONSTRAINT "payment_methods_org_customer_fkey"
  FOREIGN KEY ("organization_id", "customer_id")
  REFERENCES "customers"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "journal_entry_lines"
  ADD CONSTRAINT "journal_entry_lines_org_journal_entry_fkey"
  FOREIGN KEY ("organization_id", "journal_entry_id")
  REFERENCES "journal_entries"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "journal_entry_lines"
  ADD CONSTRAINT "journal_entry_lines_org_account_fkey"
  FOREIGN KEY ("organization_id", "account_id")
  REFERENCES "chart_of_accounts"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "revenue_recognition_schedules"
  ADD CONSTRAINT "rrs_org_invoice_fkey"
  FOREIGN KEY ("organization_id", "invoice_id")
  REFERENCES "invoices"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "revenue_recognition_schedules"
  ADD CONSTRAINT "rrs_org_subscription_fkey"
  FOREIGN KEY ("organization_id", "subscription_id")
  REFERENCES "subscriptions"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "revenue_recognition_schedules"
  ADD CONSTRAINT "rrs_org_journal_entry_fkey"
  FOREIGN KEY ("organization_id", "journal_entry_id")
  REFERENCES "journal_entries"("organization_id", "id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "webhook_events"
  ADD CONSTRAINT "webhook_events_org_endpoint_fkey"
  FOREIGN KEY ("organization_id", "endpoint_id")
  REFERENCES "webhook_endpoints"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
