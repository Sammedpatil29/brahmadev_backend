import { fetchAccountAdSpend, checkMetaAdAccountStatus } from '../services/metaAdsService.js';
import { sendDailyMetaAdReport, sendMonthlyMetaGstReport } from '../services/metaReportCronService.js';

/**
 * Controller for Meta Ads Spending and Performance Insights
 */

export const getMetaAdSpend = async (req, res) => {
  try {
    const { date_preset, since, until, from, to, startDate, endDate, level, campaign_filter, campaign_ids } = req.query;

    const resolvedSince = since || from || startDate;
    const resolvedUntil = until || to || endDate;

    const report = await fetchAccountAdSpend({
      date_preset: (resolvedSince && resolvedUntil) ? undefined : (date_preset || 'this_month'),
      since: resolvedSince,
      until: resolvedUntil,
      level,
      campaign_filter,
      campaign_ids
    });

    return res.status(200).json(report);
  } catch (error) {
    console.error('Error in getMetaAdSpend controller:', error);
    return res.status(500).json({
      configured: false,
      error: true,
      message: 'Failed to retrieve Meta Ads spend report',
      details: error.message
    });
  }
};

export const getMetaAdStatus = async (req, res) => {
  try {
    const status = await checkMetaAdAccountStatus();
    return res.status(200).json(status);
  } catch (error) {
    console.error('Error in getMetaAdStatus controller:', error);
    return res.status(500).json({
      connected: false,
      configured: false,
      error: error.message
    });
  }
};

/**
 * Manually trigger Daily Meta Ads report (for testing or on-demand delivery)
 */
export const triggerDailyReport = async (req, res) => {
  try {
    const { date } = req.body || {};
    const result = await sendDailyMetaAdReport(date);
    return res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('Error in triggerDailyReport:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Manually trigger Monthly Meta Ads GST report (for testing or on-demand delivery)
 */
export const triggerMonthlyReport = async (req, res) => {
  try {
    const { month } = req.body || {}; // e.g. '2026-08'
    const result = await sendMonthlyMetaGstReport(month);
    return res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('Error in triggerMonthlyReport:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};


