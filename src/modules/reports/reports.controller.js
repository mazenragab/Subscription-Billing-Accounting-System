import {
  getTrialBalanceReport,
  getIncomeStatementReport,
  getBalanceSheetReport,
  getARAgingReport,
  getDeferredRevenueWaterfallReport,
  getMRRReport,
  getChurnReportService,
  runRevenueRecognitionService,
} from './reports.service.js';

/**
 * Reports Controller
 * Handles HTTP request/response for financial reports
 */

/**
 * Get trial balance
 */
export async function getTrialBalance(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await getTrialBalanceReport(organizationId, query);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get income statement
 */
export async function getIncomeStatement(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await getIncomeStatementReport(organizationId, query);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get balance sheet
 */
export async function getBalanceSheet(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await getBalanceSheetReport(organizationId, query);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get AR aging report
 */
export async function getARAging(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await getARAgingReport(organizationId, query);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get deferred revenue waterfall
 */
export async function getDeferredRevenueWaterfall(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await getDeferredRevenueWaterfallReport(organizationId, query);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get MRR report
 */
export async function getMRR(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await getMRRReport(organizationId, query);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get churn report
 */
export async function getChurn(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const query = req.query;
    
    const result = await getChurnReportService(organizationId, query);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Run manual month-end revenue recognition
 */
export async function runRevenueRecognition(req, res, next) {
  try {
    const organizationId = req.tenantId;
    const userId = req.user.userId;
    const data = req.body;

    const result = await runRevenueRecognitionService(organizationId, data, userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
  getARAging,
  getDeferredRevenueWaterfall,
  getMRR,
  getChurn,
  runRevenueRecognition,
};
