import express from 'express';
import { getMetaAdSpend, getMetaAdStatus, triggerDailyReport, triggerMonthlyReport } from '../controllers/adSpendController.js';

const router = express.Router();

router.get('/meta/ad-spend', getMetaAdSpend);
router.get('/meta/ad-account-status', getMetaAdStatus);
router.post('/meta/cron/trigger-daily', triggerDailyReport);
router.post('/meta/cron/trigger-monthly', triggerMonthlyReport);

export default router;

