import express from 'express';
import { createSiteDetails, getVisitsByToken, getAllVisits, uploadImage } from '../controllers/siteController.js';

const router = express.Router();

router.post('/site-details', createSiteDetails);
router.post('/visits-by-token', getVisitsByToken);
router.get('/all-visits', getAllVisits);
router.post('/upload', uploadImage);

export default router;