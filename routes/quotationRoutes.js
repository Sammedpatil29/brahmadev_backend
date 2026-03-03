import express from 'express';
import { createQuotation, getAllQuotations, getQuotationById, updateQuotation, deleteQuotation } from '../controllers/quotationController.js';

const router = express.Router();

router.post('/quotations', createQuotation);
router.get('/quotations', getAllQuotations);
router.get('/quotations/:id', getQuotationById);
router.patch('/quotations/:id', updateQuotation);
router.delete('/quotations/:id', deleteQuotation);


export default router;