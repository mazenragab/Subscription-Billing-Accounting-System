import authRoutes from './auth/auth.routes.js';
import organizationsRoutes from './organizations/organizations.routes.js';
import customersRoutes from './customers/customers.routes.js';
import plansRoutes from './plans/plans.routes.js';
import subscriptionsRoutes from './subscriptions/subscriptions.routes.js';
import invoicesRoutes from './invoices/invoices.routes.js';
import paymentsRoutes from './payments/payments.routes.js';
import reportsRoutes from './reports/reports.routes.js';
import discountCodesRoutes from './discount-codes/discount-codes.routes.js';
import webhooksRoutes from './webhooks/webhooks.routes.js';
import billingRoutes from './billing/billing.routes.js';
import accountingRoutes from './accounting/accounting.routes.js';

export function registerRoutes(app, options = {}) {
  const apiPrefix = options.apiPrefix || '/api/v1';
  
  // Register all route modules
  app.use(`${apiPrefix}/auth`, authRoutes);
  app.use(`${apiPrefix}/organizations`, organizationsRoutes);
  app.use(`${apiPrefix}/customers`, customersRoutes);
  app.use(`${apiPrefix}/plans`, plansRoutes);
  app.use(`${apiPrefix}/subscriptions`, subscriptionsRoutes);
  app.use(`${apiPrefix}/invoices`, invoicesRoutes);
  app.use(`${apiPrefix}/payments`, paymentsRoutes);
  app.use(`${apiPrefix}/reports`, reportsRoutes);
  app.use(`${apiPrefix}/discount-codes`, discountCodesRoutes);
  app.use(`${apiPrefix}/webhooks`, webhooksRoutes);
  app.use(`${apiPrefix}/billing`, billingRoutes);
  app.use(`${apiPrefix}/accounting`, accountingRoutes);
  
  // Return registered routes info
  const registeredRoutes = [
    'auth',
    'organizations',
    'customers',
    'plans',
    'subscriptions',
    'invoices',
    'payments',
    'reports',
    'discount-codes',
    'webhooks',
    'billing',
    'accounting',
  ];
  
  return {
    registered: registeredRoutes,
    count: registeredRoutes.length,
    prefix: apiPrefix,
  };
}

export default {
  registerRoutes,
};
