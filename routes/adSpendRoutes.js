import express from 'express';
import { getMetaAdSpend, getMetaAdStatus } from '../controllers/adSpendController.js';

const router = express.Router();

router.get('/meta/ad-spend', getMetaAdSpend);
router.get('/meta/ad-account-status', getMetaAdStatus);

export default router;

