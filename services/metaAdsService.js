import axios from 'axios';

/**
 * Meta Marketing API Service
 * Interacts with Facebook/Meta Graph API to fetch Ads Insights, spend reports, and campaign stats.
 * Supports filtering insights by Campaign IDs (recommended) or Campaign Names.
 */

const getMetaConfig = () => {
  const accountIdRaw = process.env.META_AD_ACCOUNT_ID || process.env.FB_AD_ACCOUNT_ID || '';
  const adAccountId = accountIdRaw.startsWith('act_') ? accountIdRaw : (accountIdRaw ? `act_${accountIdRaw}` : '');
  const accessToken = process.env.META_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '';
  const apiVersion = process.env.META_API_VERSION || 'v21.0';
  const campaignIds = process.env.META_CAMPAIGN_IDS || '';
  const campaignFilter = process.env.META_CAMPAIGN_FILTER || '';

  return {
    adAccountId,
    accessToken,
    apiVersion,
    campaignIds,
    campaignFilter,
    isConfigured: Boolean(adAccountId && accessToken && accessToken !== 'your_long_lived_token')
  };
};

/**
 * Normalize text for robust matching (handles en-dash, em-dash, hyphens, multiple spaces)
 */
const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u2010\u2012\u2013\u2014\u2015\u2212\-]/g, ' ') // replace all dash variations with space
    .replace(/[^a-z0-9\s]/g, ' ') // replace special punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Helper to extract lead count from Meta actions array without double-counting Meta action aliases
 */
const extractLeadsCount = (actions) => {
  if (!Array.isArray(actions) || actions.length === 0) return 0;

  const actionMap = {};
  actions.forEach(a => {
    if (a.action_type) {
      actionMap[a.action_type] = parseInt(a.value, 10) || 0;
    }
  });

  // 1. Instant Form Leads (Meta returns multiple aliases like lead, leadgen_grouped, onsite_conversion.lead_grouped)
  const formLeads = Math.max(
    actionMap['onsite_conversion.lead_grouped'] || 0,
    actionMap['leadgen_grouped'] || 0,
    actionMap['lead'] || 0
  );

  // 2. Messaging Conversations Started (WhatsApp / Messenger / IG DM leads)
  const msgLeads = Math.max(
    actionMap['messaging_conversation_started_7d'] || 0,
    actionMap['onsite_conversion.messaging_conversation_started_7d'] || 0,
    actionMap['onsite_conversion.messaging_first_reply'] || 0
  );

  // 3. Website / Pixel Contact Leads
  const contactLeads = Math.max(
    actionMap['contact'] || 0,
    actionMap['offsite_conversion.fb_pixel_lead'] || 0,
    actionMap['offsite_conversion.fb_pixel_custom'] || 0
  );

  const total = formLeads + msgLeads + contactLeads;

  // If none of the specific types matched, search for any general lead action
  if (total === 0) {
    for (const [key, val] of Object.entries(actionMap)) {
      if (key.includes('lead') || key.includes('contact')) {
        return val;
      }
    }
  }

  return total;
};

const parseList = (str) => {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
};

/**
 * Helper to check if a campaign matches configured IDs or Name filters
 */
const isCampaignTargeted = (item, targetIds, targetNames) => {
  const itemCampaignId = String(item.campaign_id || item.campaignId || '').trim();
  const itemCampaignName = item.campaign_name || item.campaignName || '';

  // 1. Check Campaign ID match first (highest priority)
  if (targetIds.length > 0) {
    if (targetIds.includes(itemCampaignId)) {
      return true;
    }
  }

  // 2. Check Campaign Name match
  if (targetNames.length > 0) {
    const normName = normalizeText(itemCampaignName);
    const matched = targetNames.some(filter => {
      const normFilter = normalizeText(filter);
      if (!normFilter) return false;
      return normName.includes(normFilter) || normFilter.includes(normName);
    });
    if (matched) return true;
  }

  // If no filters are defined at all, match everything
  return targetIds.length === 0 && targetNames.length === 0;
};

/**
 * Fetch Account / Campaign-Filtered Ad Spend & Performance Metrics
 */
export const fetchAccountAdSpend = async (options = {}) => {
  const { date_preset = 'this_month', since, until, campaign_ids, campaign_filter } = options;
  const config = getMetaConfig();

  if (!config.isConfigured) {
    return {
      configured: false,
      message: 'Meta Ad Account ID or Access Token not configured in backend .env',
      currency: 'INR',
      summary: {
        totalSpend: 0,
        gstAmount: 0,
        totalSpendWithGst: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalLeads: 0,
        reach: 0,
        cpc: 0,
        cpm: 0,
        ctr: 0,
        costPerLead: 0,
        costPerLeadWithGst: 0
      },
      dailyTrends: [],
      campaigns: []
    };
  }

  const targetIds = parseList(campaign_ids || config.campaignIds);
  const targetNames = parseList(campaign_filter || config.campaignFilter);

  try {
    // 1. Fetch Campaign-level insights to allow accurate ID/Name filtering
    const campaignParams = {
      access_token: config.accessToken,
      level: 'campaign',
      fields: 'campaign_id,campaign_name,objective,spend,impressions,clicks,cpc,cpm,ctr,reach,actions,cost_per_action_type,date_start,date_stop,account_currency'
    };

    if (since && until) {
      campaignParams.time_range = JSON.stringify({ since, until });
    } else {
      campaignParams.date_preset = date_preset;
    }

    const campaignUrl = `https://graph.facebook.com/${config.apiVersion}/${config.adAccountId}/insights`;
    const campaignRes = await axios.get(campaignUrl, { params: campaignParams });
    const allCampaigns = campaignRes.data?.data || [];

    console.log(`[Meta Ads] Found ${allCampaigns.length} campaigns in account:`, allCampaigns.map(c => ({ id: c.campaign_id, name: c.campaign_name })));

    // Filter campaigns based on IDs / Names
    const hasFilter = targetIds.length > 0 || targetNames.length > 0;
    const targetCampaigns = hasFilter
      ? allCampaigns.filter(item => isCampaignTargeted(item, targetIds, targetNames))
      : allCampaigns;

    console.log(`[Meta Ads] Filtered to ${targetCampaigns.length} matching campaigns:`, targetCampaigns.map(c => ({ id: c.campaign_id, name: c.campaign_name })));

    // Calculate aggregated metrics across matching campaigns
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalLeads = 0;
    let totalReach = 0;
    let currency = 'INR';
    let dateStart = '';
    let dateStop = '';

    const campaigns = targetCampaigns.map(item => {
      const spend = parseFloat(item.spend) || 0;
      const impressions = parseInt(item.impressions, 10) || 0;
      const clicks = parseInt(item.clicks, 10) || 0;
      const reach = parseInt(item.reach, 10) || 0;
      const leads = extractLeadsCount(item.actions);
      const cpl = leads > 0 ? spend / leads : 0;
      const ctr = parseFloat(item.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0);
      const gstAmount = Math.round(spend * 0.18 * 100) / 100;
      const spendWithGst = Math.round((spend + gstAmount) * 100) / 100;
      const cplWithGst = leads > 0 ? Math.round((spendWithGst / leads) * 100) / 100 : 0;

      totalSpend += spend;
      totalImpressions += impressions;
      totalClicks += clicks;
      totalLeads += leads;
      totalReach += reach;
      if (item.account_currency) currency = item.account_currency;
      if (item.date_start) dateStart = item.date_start;
      if (item.date_stop) dateStop = item.date_stop;

      return {
        campaignId: item.campaign_id,
        campaignName: item.campaign_name || 'Unnamed Campaign',
        objective: item.objective || '',
        spend: Math.round(spend * 100) / 100,
        gstAmount,
        spendWithGst,
        impressions,
        clicks,
        reach,
        leads,
        cpl: Math.round(cpl * 100) / 100,
        cplWithGst,
        ctr: Math.round(ctr * 100) / 100
      };
    }).sort((a, b) => b.spend - a.spend);

    const roundedSpend = Math.round(totalSpend * 100) / 100;
    const totalGst = Math.round(totalSpend * 0.18 * 100) / 100;
    const totalSpendWithGst = Math.round((totalSpend + totalGst) * 100) / 100;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const costPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const costPerLeadWithGst = totalLeads > 0 ? Math.round((totalSpendWithGst / totalLeads) * 100) / 100 : 0;

    // 2. Fetch Daily breakdown filtered for matching campaigns
    const dailyTrends = await fetchDailySpendTrends(options, config, targetIds, targetNames);

    return {
      configured: true,
      currency,
      dateStart,
      dateStop,
      filterApplied: {
        campaignIds: targetIds,
        campaignNames: targetNames
      },
      summary: {
        totalSpend: roundedSpend,
        gstAmount: totalGst,
        totalSpendWithGst: totalSpendWithGst,
        totalImpressions,
        totalClicks,
        totalLeads,
        reach: totalReach,
        cpc: Math.round(cpc * 100) / 100,
        cpm: Math.round(cpm * 100) / 100,
        ctr: Math.round(ctr * 100) / 100,
        costPerLead: Math.round(costPerLead * 100) / 100,
        costPerLeadWithGst: costPerLeadWithGst
      },
      dailyTrends,
      campaigns
    };
  } catch (error) {
    console.error('Meta Marketing API error:', error?.response?.data || error.message);
    const errorDetails = error?.response?.data?.error;
    
    // Diagnostic check: Query which ad accounts this token actually has permission to read
    let accessibleAccounts = [];
    try {
      const accRes = await axios.get(`https://graph.facebook.com/${config.apiVersion}/me/adaccounts`, {
        params: {
          access_token: config.accessToken,
          fields: 'id,name,account_id,account_status'
        }
      });
      accessibleAccounts = accRes.data?.data || [];
      console.log(`[Meta Ads Diagnostic] Token currently has access to ${accessibleAccounts.length} ad accounts:`, accessibleAccounts);
    } catch (accErr) {
      console.log('[Meta Ads Diagnostic] Could not fetch me/adaccounts:', accErr?.response?.data || accErr.message);
    }

    let customMsg = errorDetails?.message || error.message;
    if (errorDetails?.code === 200) {
      if (accessibleAccounts.length > 0) {
        customMsg = `Ad account '${config.adAccountId}' is not accessible by this token. Accessible accounts found: ${accessibleAccounts.map(a => a.id + ' (' + a.name + ')').join(', ')}`;
      } else {
        customMsg = `This token has no access to ad account '${config.adAccountId}'. Ensure the token was generated with 'ads_read' approved, and that the account '${config.adAccountId}' is assigned to your user/portfolio in Business Settings.`;
      }
    }

    return {
      configured: false,
      error: true,
      errorMessage: customMsg,
      errorCode: errorDetails?.code,
      accessibleAccounts,
      summary: {
        totalSpend: 0,
        gstAmount: 0,
        totalSpendWithGst: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalLeads: 0,
        reach: 0,
        cpc: 0,
        cpm: 0,
        ctr: 0,
        costPerLead: 0,
        costPerLeadWithGst: 0
      },
      dailyTrends: [],
      campaigns: []
    };
  }
};

/**
 * Fetch Daily Spend Breakdown for Matching Campaigns (level=campaign, time_increment=1)
 */
export const fetchDailySpendTrends = async (options = {}, configParam = null, targetIdsParam = null, targetNamesParam = null) => {
  const { date_preset = 'this_month', since, until, campaign_ids, campaign_filter } = options;
  const config = configParam || getMetaConfig();
  const targetIds = targetIdsParam || parseList(campaign_ids || config.campaignIds);
  const targetNames = targetNamesParam || parseList(campaign_filter || config.campaignFilter);

  if (!config.isConfigured) return [];

  try {
    const params = {
      access_token: config.accessToken,
      level: 'campaign',
      time_increment: '1',
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,cpc,cpm,ctr,reach,actions,date_start,date_stop'
    };

    if (since && until) {
      params.time_range = JSON.stringify({ since, until });
    } else {
      params.date_preset = date_preset;
    }

    const url = `https://graph.facebook.com/${config.apiVersion}/${config.adAccountId}/insights`;
    const response = await axios.get(url, { params });
    const list = response.data?.data || [];

    // Filter by matching campaigns
    const hasFilter = targetIds.length > 0 || targetNames.length > 0;
    const targetList = hasFilter
      ? list.filter(item => isCampaignTargeted(item, targetIds, targetNames))
      : list;

    // Group and aggregate by date
    const dailyMap = new Map();

    targetList.forEach(item => {
      const date = item.date_start;
      const spend = parseFloat(item.spend) || 0;
      const impressions = parseInt(item.impressions, 10) || 0;
      const clicks = parseInt(item.clicks, 10) || 0;
      const reach = parseInt(item.reach, 10) || 0;
      const leads = extractLeadsCount(item.actions);

      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          spend,
          impressions,
          clicks,
          reach,
          leads
        });
      } else {
        const existing = dailyMap.get(date);
        existing.spend += spend;
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.reach += reach;
        existing.leads += leads;
      }
    });

    return Array.from(dailyMap.values()).map(item => ({
      date: item.date,
      spend: Math.round(item.spend * 100) / 100,
      impressions: item.impressions,
      clicks: item.clicks,
      reach: item.reach,
      leads: item.leads,
      cpl: item.leads > 0 ? Math.round((item.spend / item.leads) * 100) / 100 : 0
    })).sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.error('Error fetching daily spend trends:', err?.response?.data || err.message);
    return [];
  }
};

/**
 * Check Meta Ad Account connection & status
 */
export const checkMetaAdAccountStatus = async () => {
  const config = getMetaConfig();
  if (!config.isConfigured) {
    return {
      connected: false,
      configured: false,
      message: 'Meta Ad Account ID or Access Token is missing in environment variables.'
    };
  }

  try {
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.adAccountId}`;
    const response = await axios.get(url, {
      params: {
        access_token: config.accessToken,
        fields: 'id,name,account_status,currency,timezone_name,spend_cap,amount_spent'
      }
    });

    const d = response.data;
    const statusMap = {
      1: 'ACTIVE',
      2: 'DISABLED',
      3: 'UNSETTLED',
      7: 'PENDING_RISK_REVIEW',
      8: 'PENDING_SETTLEMENT',
      9: 'IN_GRACE_PERIOD',
      100: 'PENDING_CLOSURE',
      101: 'CLOSED',
      201: 'ANY_ACTIVE',
      202: 'ANY_CLOSED'
    };

    return {
      connected: true,
      configured: true,
      accountId: d.id,
      accountName: d.name,
      currency: d.currency || 'INR',
      timezone: d.timezone_name,
      campaignIds: config.campaignIds,
      campaignFilter: config.campaignFilter,
      accountStatus: statusMap[d.account_status] || `STATUS_${d.account_status}`,
      amountSpent: d.amount_spent ? parseFloat(d.amount_spent) / 100 : undefined
    };
  } catch (error) {
    return {
      connected: false,
      configured: true,
      error: error?.response?.data?.error?.message || error.message
    };
  }
};
