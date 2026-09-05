import { Quotation, Invoice } from '../models/quotation.js';
import { bucket } from '../firebase.js';

// ✅ Create a new quotation
export const createQuotation = async (req, res) => {
  try {
    const {
      quoteId,
      customerName,
      siteAddress,
      contact,
      email,
      date,
      grandTotal,
      base64
    } = req.body;

    if (!base64) {
      return res.status(400).json({ error: 'Base64 PDF data is required' });
    }

    // 1. Convert base64 to buffer
    // Remove data URI prefix if present (e.g., "data:application/pdf;base64,")
    const base64EncodedPdfString = base64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64EncodedPdfString, 'base64');

    // 2. Define file name and path in Firebase Storage
    const fileName = `quotations/${quoteId}_${customerName}.pdf`;
    const file = bucket.file(fileName);

    // 3. Upload to Firebase
    await file.save(buffer, {
      metadata: { contentType: 'application/pdf' },
      public: true,
      validation: 'md5',
    });

    // 4. Get the public URL
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${process.env.FIREBASE_BUCKET}/o/${encodeURIComponent(fileName)}?alt=media`;

    // 5. Save to Database (replacing base64 with url)
    const newQuotation = await Quotation.create({
      quoteId,
      customerName,
      siteAddress,
      contact,
      email: email || null,
      date,
      grandTotal,
      url: publicUrl
    });

    res.status(201).json({
      message: 'Quotation created and PDF uploaded successfully',
      quotation: newQuotation
    });

  } catch (error) {
    console.error('Error creating quotation:', error);
    res.status(500).json({ error: 'Failed to create quotation' });
  }
};

// ✅ Get all quotations
export const getAllQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.findAll();
    res.status(200).json(quotations);
  } catch (error) {
    console.error('Error fetching quotations:', error);
    res.status(500).json({ error: 'Failed to fetch quotations' });
  }
};

// ✅ Get a specific quotation by ID
export const getQuotationById = async (req, res) => {
  try {
    const { id } = req.params;
    const quotation = await Quotation.findByPk(id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }
    res.status(200).json(quotation);
  } catch (error) {
    console.error('Error fetching quotation:', error);
    res.status(500).json({ error: 'Failed to fetch quotation' });
  }
};

// ✅ Update an existing quotation (Note: This will not update the PDF file itself)
export const updateQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const { quoteId, customerName, siteAddress, contact, email, date, grandTotal } = req.body;

    const quotation = await Quotation.findByPk(id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    await quotation.update({ quoteId, customerName, siteAddress, contact, email, date, grandTotal });
    res.status(200).json({ message: 'Quotation updated successfully', quotation });

  } catch (error) {
    console.error('Error updating quotation:', error);
    res.status(500).json({ error: 'Failed to update quotation' });
  }
};

// ✅ Delete a quotation and remove the corresponding PDF file from Firebase Storage
export const deleteQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const quotation = await Quotation.findByPk(id);

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // Extract the file name from the URL
    const urlParts = quotation.url.split('/o/');
    const fileName = urlParts[1].split('?')[0];

    // Delete the file from Firebase Storage
    await bucket.file(decodeURIComponent(fileName)).delete();

    // Remove the quotation from the database
    await quotation.destroy();

    res.status(200).json({ message: 'Quotation deleted successfully' });

  } catch (error) {
    console.error('Error deleting quotation:', error);
    res.status(500).json({ error: 'Failed to delete quotation' });
  }
};

// ✅ Download quotation PDF directly from Firebase Storage stream
export const downloadQuotationPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const quotation = await Quotation.findByPk(id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    if (!quotation.url) {
      return res.status(404).json({ error: 'Quotation PDF URL not found' });
    }

    // Try extracting file name from Firebase Storage URL
    const urlParts = quotation.url.split('/o/');
    if (urlParts.length >= 2) {
      const rawFileName = urlParts[1].split('?')[0];
      const fileName = decodeURIComponent(rawFileName);
      const file = bucket.file(fileName);
      const [exists] = await file.exists();

      if (exists) {
        const safeCustomer = (quotation.customerName || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
        const safeFileName = `${quotation.quoteId || 'Quote'}_${safeCustomer}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
        return file.createReadStream().pipe(res);
      }
    }

    // Fallback: Redirect directly to the stored URL
    return res.redirect(quotation.url);
  } catch (error) {
    console.error('Error downloading quotation PDF:', error);
    res.status(500).json({ error: 'Failed to download quotation PDF' });
  }
};

// ✅ Create a new invoice
export const createInvoice = async (req, res) => {
  try {
    const {
      invoiceId,
      customerName,
      siteAddress,
      contact,
      email,
      customerGst,
      date,
      grandTotal,
      base64
    } = req.body;

    let publicUrl = '';
    if (base64) {
      const base64EncodedPdfString = base64.replace(/^data:application\/pdf;base64,/, '');
      const buffer = Buffer.from(base64EncodedPdfString, 'base64');
      const safeCustomer = (customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `invoices/${invoiceId || Date.now()}_${safeCustomer}.pdf`;
      const file = bucket.file(fileName);

      await file.save(buffer, {
        metadata: { contentType: 'application/pdf' },
        public: true,
        validation: 'md5',
      });

      publicUrl = `https://firebasestorage.googleapis.com/v0/b/${process.env.FIREBASE_BUCKET}/o/${encodeURIComponent(fileName)}?alt=media`;
    }

    const newInvoice = await Invoice.create({
      invoiceId,
      customerName,
      siteAddress,
      contact,
      email: email || null,
      customerGst: customerGst || null,
      date: date || new Date(),
      grandTotal: grandTotal || 0,
      url: publicUrl
    });

    res.status(201).json({
      message: 'Invoice created and saved successfully',
      invoice: newInvoice
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

// ✅ Get all invoices
export const getAllInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

// ✅ Delete an invoice and remove the corresponding PDF file from Firebase Storage
export const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Try deleting the file from Firebase Storage if URL is present
    if (invoice.url && invoice.url.includes('/o/')) {
      try {
        const urlParts = invoice.url.split('/o/');
        const fileName = urlParts[1].split('?')[0];
        await bucket.file(decodeURIComponent(fileName)).delete();
      } catch (storageErr) {
        console.warn('Could not delete invoice file from storage:', storageErr);
      }
    }

    // Remove the invoice from the database
    await invoice.destroy();

    res.status(200).json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
};

// ✅ Download invoice PDF directly from Firebase Storage stream
export const downloadInvoicePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (!invoice.url) {
      return res.status(404).json({ error: 'Invoice PDF URL not found' });
    }

    // Try extracting file name from Firebase Storage URL
    const urlParts = invoice.url.split('/o/');
    if (urlParts.length >= 2) {
      const rawFileName = urlParts[1].split('?')[0];
      const fileName = decodeURIComponent(rawFileName);
      const file = bucket.file(fileName);
      const [exists] = await file.exists();

      if (exists) {
        const safeCustomer = (invoice.customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
        const safeFileName = `${invoice.invoiceId || 'Invoice'}_${safeCustomer}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
        return file.createReadStream().pipe(res);
      }
    }

    // Fallback: Redirect directly to the stored URL
    return res.redirect(invoice.url);
  } catch (error) {
    console.error('Error downloading invoice PDF:', error);
    res.status(500).json({ error: 'Failed to download invoice PDF' });
  }
};