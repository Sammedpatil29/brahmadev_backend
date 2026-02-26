import express from 'express';
import { createMetaLead, sendCustomFcm, getLeads, updateLead, getLeadById, getNewLeadsCount } from '../controllers/leadController.js';

const router = express.Router();

router.post('/meta-leads', createMetaLead);
router.post('/custom-fcm', sendCustomFcm);
router.get('/leads', getLeads);
router.patch('/leads/:id', updateLead);
router.get('/leads/count/new', getNewLeadsCount);
router.get('/leads/:id', getLeadById);

export default router;