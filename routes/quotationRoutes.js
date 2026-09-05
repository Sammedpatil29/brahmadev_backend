import express from 'express';
import { 
  createQuotation, 
  getAllQuotations, 
  getQuotationById, 
  updateQuotation, 
  deleteQuotation, 
  downloadQuotationPdf,
  createInvoice,
  getAllInvoices,
  deleteInvoice,
  downloadInvoicePdf
} from '../controllers/quotationController.js';

const router = express.Router();

router.post('/quotations', createQuotation);
router.get('/quotations', getAllQuotations);
router.get('/quotations/:id', getQuotationById);
router.get('/quotations/:id/download', downloadQuotationPdf);
router.patch('/quotations/:id', updateQuotation);
router.delete('/quotations/:id', deleteQuotation);

// Invoices
router.post('/invoices', createInvoice);
router.get('/invoices', getAllInvoices);
router.get('/invoices/:id/download', downloadInvoicePdf);
router.delete('/invoices/:id', deleteInvoice);

export default router;