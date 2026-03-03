import { Quotation } from '../models/quotation.js';
import { bucket } from '../firebase.js';

// ✅ Create a new quotation
export const createQuotation = async (req, res) => {
  try {
    const {
      quoteId,
      customerName,
      siteAddress,
      contact,
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
    const { quoteId, customerName, siteAddress, contact, date, grandTotal } = req.body;

    const quotation = await Quotation.findByPk(id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    await quotation.update({ quoteId, customerName, siteAddress, contact, date, grandTotal });
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