import { fetchAccountAdSpend, checkMetaAdAccountStatus } from '../services/metaAdsService.js';

/**
 * Controller for Meta Ads Spending and Performance Insights
 */

export const getMetaAdSpend = async (req, res) => {
  try {
    const { date_preset, since, until, level, campaign_filter, campaign_ids } = req.query;

    const report = await fetchAccountAdSpend({
      date_preset: date_preset || 'this_month',
      since,
      until,
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

