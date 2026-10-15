import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorker, type Worker } from 'tesseract.js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

export interface ParsedInvoiceData {
  rawText: string;
  invoiceNumber?: string;
  invoiceDate?: string; // YYYY-MM-DD
  amount?: number;
  currency?: string;
  vendor?: string;
  categorySuggestion?: string;
  descriptionSuggestion?: string;
  parseMethod: 'pdf-parse' | 'tesseract-ocr' | 'none';
  confidence: {
    invoiceNumber: number;
    invoiceDate: number;
    amount: number;
  };
}

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

const KNOWN_VENDORS = [
  {
    name: 'Amazon Web Services',
    pattern: /\b(?:amazon\s+web\s+services|aws)\b/i,
    category: 'Software & Cloud',
  },
  { name: 'GitHub', pattern: /\bgithub\b/i, category: 'Software & Cloud' },
  {
    name: 'Slack Technologies',
    pattern: /\bslack\b/i,
    category: 'Software & Cloud',
  },
  {
    name: 'Apple',
    pattern: /\bapple(?:\s+inc\.?|\s+store)?\b/i,
    category: 'Hardware & Equipment',
  },
  {
    name: 'Dell Technologies',
    pattern: /\bdell\b/i,
    category: 'Hardware & Equipment',
  },
  {
    name: 'Delta Air Lines',
    pattern: /\bdelta(?:\s+air\s+lines|\s+flight)?\b/i,
    category: 'Travel & Transport',
  },
  { name: 'Uber', pattern: /\buber\b/i, category: 'Travel & Transport' },
  {
    name: 'Grand Hyatt',
    pattern: /\b(?:grand\s+)?hyatt\b/i,
    category: 'Lodging & Accommodation',
  },
  {
    name: 'Jumeirah Hotels',
    pattern: /\bjumeirah\b/i,
    category: 'Lodging & Accommodation',
  },
  {
    name: "Morton's The Steakhouse",
    pattern: /\bmorton'?s\b/i,
    category: 'Meals & Entertainment',
  },
  {
    name: 'Starbucks',
    pattern: /\bstarbucks\b/i,
    category: 'Meals & Entertainment',
  },
  {
    name: 'FedEx Express',
    pattern: /\bfedex\b/i,
    category: 'Shipping & Logistics',
  },
  {
    name: 'Studio Vertex Design',
    pattern: /\bstudio\s+vertex\b/i,
    category: 'Professional Services',
  },
  {
    name: 'TechSolutions India',
    pattern: /\btechsolutions\b/i,
    category: 'Professional Services',
  },
  { name: 'WeWork', pattern: /\bwework\b/i, category: 'Office & Facilities' },
];

@Injectable()
export class InvoiceParseService implements OnModuleDestroy {
  private readonly logger = new Logger(InvoiceParseService.name);
  private worker: Worker | null = null;
  private queue: Promise<void> = Promise.resolve();
  private cache = new Map<string, { data: ParsedInvoiceData; at: number }>();

  async onModuleDestroy() {
    if (!this.worker) return;
    try {
      await this.worker.terminate();
    } catch {
      /* ignore */
    }
    this.worker = null;
  }

  /**
   * Parses an invoice file (PDF or Image) using local PDF text extraction or Tesseract OCR.
   * Zero external AI APIs required.
   */
  async parse(
    buffer: Buffer,
    originalName = '',
    mimeType = '',
  ): Promise<ParsedInvoiceData> {
    const hash = createHash('sha256').update(buffer).digest('hex');
    const cached = this.cache.get(hash);
    if (cached && Date.now() - cached.at < 30 * 60 * 1000) {
      return cached.data;
    }

    const kind = this.detectFileKind(buffer, originalName, mimeType);
    let rawText = '';
    let parseMethod: 'pdf-parse' | 'tesseract-ocr' | 'none' = 'none';

    if (kind === 'pdf') {
      try {
        const parsedPdf = await pdfParse(buffer);
        rawText = parsedPdf.text || '';
        if (rawText.trim().length >= 25) {
          parseMethod = 'pdf-parse';
        }
      } catch (err) {
        this.logger.warn(
          `pdf-parse failed: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }

      // If scanned PDF with no text layer, fallback to OCR on embedded images
      if (!rawText.trim()) {
        const ocrText = await this.ocrPdfImages(buffer);
        if (ocrText.trim()) {
          rawText = ocrText;
          parseMethod = 'tesseract-ocr';
        }
      }
    } else if (kind === 'image') {
      rawText = await this.ocrImage(buffer);
      if (rawText.trim()) {
        parseMethod = 'tesseract-ocr';
      }
    }

    const extracted = this.extractFields(rawText, parseMethod);
    this.cache.set(hash, { data: extracted, at: Date.now() });

    // Keep cache bounded
    if (this.cache.size > 100) {
      const oldest = [...this.cache.entries()].sort(
        (a, b) => a[1].at - b[1].at,
      )[0];
      if (oldest) this.cache.delete(oldest[0]);
    }

    return extracted;
  }

  private detectFileKind(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): 'pdf' | 'image' | 'unknown' {
    const mime = (mimeType || '').toLowerCase();
    const name = (originalName || '').toLowerCase();
    if (
      mime.includes('pdf') ||
      name.endsWith('.pdf') ||
      (buffer.length >= 5 && buffer.subarray(0, 5).toString() === '%PDF-')
    ) {
      return 'pdf';
    }
    if (
      mime.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif|bmp)$/.test(name) ||
      (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) ||
      (buffer.length >= 8 &&
        buffer
          .subarray(0, 8)
          .equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          ))
    ) {
      return 'image';
    }
    return 'unknown';
  }

  private extractFields(
    rawText: string,
    parseMethod: 'pdf-parse' | 'tesseract-ocr' | 'none',
  ): ParsedInvoiceData {
    const text = (rawText || '').trim();
    if (!text) {
      return {
        rawText: '',
        parseMethod: 'none',
        confidence: { invoiceNumber: 0, invoiceDate: 0, amount: 0 },
      };
    }

    const invoiceNumber = this.extractInvoiceNumber(text);
    const invoiceDate = this.extractInvoiceDate(text);
    const { amount, currency } = this.extractAmountAndCurrency(text);
    const { vendor, categorySuggestion } = this.extractVendorAndCategory(text);

    let descriptionSuggestion = '';
    if (vendor && invoiceNumber) {
      descriptionSuggestion = `${vendor} - ${invoiceNumber}`;
    } else if (vendor) {
      descriptionSuggestion = `${vendor} Invoice`;
    }

    return {
      rawText: text,
      invoiceNumber: invoiceNumber || undefined,
      invoiceDate: invoiceDate || undefined,
      amount: amount || undefined,
      currency: currency || undefined,
      vendor: vendor || undefined,
      categorySuggestion: categorySuggestion || undefined,
      descriptionSuggestion: descriptionSuggestion || undefined,
      parseMethod,
      confidence: {
        invoiceNumber: invoiceNumber ? 0.9 : 0,
        invoiceDate: invoiceDate ? 0.85 : 0,
        amount: amount ? 0.85 : 0,
      },
    };
  }

  private extractInvoiceNumber(text: string): string | null {
    // 1. Label-based patterns (e.g. "Invoice #: INV-AWS-2026-8819", "Receipt ID: UBR-90214-TRIP")
    const labelPatterns = [
      /(?:invoice|inv|receipt|bill|ticket|order|folio|check|chk)\s*(?:#|no\.?|num(?:ber)?|id|code)?\s*[:#-]\s*([A-Za-z0-9][A-Za-z0-9\-_/]{2,32})/i,
      /(?:invoice|inv|receipt|bill)\s*(?:#|no\.?|num(?:ber)?)\s+([A-Za-z0-9][A-Za-z0-9\-_/]{2,32})/i,
      /(?:receipt\s*id|check\s*#|chk\s*#)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9\-_/]{2,32})/i,
    ];

    const blacklistedWords = new Set([
      'date',
      'total',
      'subtotal',
      'amount',
      'status',
      'summary',
      'table',
      'due',
      'tax',
      'vat',
      'unpaid',
      'paid',
      'invoice',
      'receipt',
      'description',
      'period',
      'details',
    ]);

    for (const p of labelPatterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const candidate = m[1].replace(/[.,:;]+$/, '').trim();
        if (
          candidate.length >= 3 &&
          !blacklistedWords.has(candidate.toLowerCase())
        ) {
          return candidate;
        }
      }
    }

    // 2. Structured prefix patterns (e.g. INV-12345, APL-ORD-901428, UBR-90214, CHK-88124)
    const prefixPatterns = [
      /\b([A-Z]{2,6}-[A-Z0-9]{2,12}(?:-[A-Z0-9]+)?)\b/,
      /\b(INV-\d{4,10})\b/i,
      /\b(UBR-\d{4,10}-[A-Z0-9]+)\b/i,
      /\b(CHK-\d{4,10})\b/i,
      /\b(REC-\d{4,10})\b/i,
    ];

    for (const p of prefixPatterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const candidate = m[1].replace(/[.,:;]+$/, '').trim();
        if (!blacklistedWords.has(candidate.toLowerCase())) {
          return candidate;
        }
      }
    }

    return null;
  }

  private extractInvoiceDate(text: string): string | null {
    // Check lines containing date keywords first
    const dateLineMatch = text.match(
      /(?:invoice\s*date|issue\s*date|billing\s*date|service\s*month|date|dated)\s*[:.-]?\s*([^\n\r]{4,40})/i,
    );
    if (dateLineMatch && dateLineMatch[1]) {
      const parsed = this.parseDateString(dateLineMatch[1]);
      if (parsed) return parsed;
    }

    // Fallback: search anywhere in text
    return this.parseDateString(text);
  }

  private parseDateString(raw: string): string | null {
    if (!raw) return null;

    // ISO: 2026-10-01
    let m = raw.match(
      /\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/,
    );
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    // Month Name first: Oct 01, 2026 or October 1, 2026
    m = raw.match(
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s]+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(20\d{2})\b/i,
    );
    if (m) {
      const mo = MONTH_MAP[m[1].toLowerCase().slice(0, 3)];
      const day = m[2].padStart(2, '0');
      return `${m[3]}-${mo}-${day}`;
    }

    // Day first: 01 Oct 2026 or 1 October 2026
    m = raw.match(
      /\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s]+(20\d{2})\b/i,
    );
    if (m) {
      const mo = MONTH_MAP[m[2].toLowerCase().slice(0, 3)];
      const day = m[1].padStart(2, '0');
      return `${m[3]}-${mo}-${day}`;
    }

    // Month Year only: October 2026 -> 2026-10-01
    m = raw.match(
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s]+(20\d{2})\b/i,
    );
    if (m) {
      const mo = MONTH_MAP[m[1].toLowerCase().slice(0, 3)];
      return `${m[2]}-${mo}-01`;
    }

    // US format: MM/DD/YYYY
    m = raw.match(/\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(20\d{2})\b/);
    if (m) return `${m[3]}-${m[1]}-${m[2]}`;

    return null;
  }

  private extractAmountAndCurrency(text: string): {
    amount?: number;
    currency?: string;
  } {
    let currency = 'USD';
    if (/\b(?:INR|₹|rupees?)\b/i.test(text)) currency = 'INR';
    else if (/\b(?:EUR|€|euros?)\b/i.test(text)) currency = 'EUR';
    else if (/\b(?:GBP|£|pounds?)\b/i.test(text)) currency = 'GBP';
    else if (/\bAED\b/i.test(text)) currency = 'AED';
    else if (/\bCAD\b/i.test(text)) currency = 'CAD';
    else if (/\bAUD\b/i.test(text)) currency = 'AUD';
    else if (/\bSGD\b/i.test(text)) currency = 'SGD';

    // Search lines with Total / Amount Due / Grand Total / Subtotal
    const totalLines = [
      /(?:total\s+due|grand\s+total|total\s+amount|amount\s+due|balance\s+due|total\s+paid|total)\s*[:.-]?\s*[$€£₹A-Za-z]{0,4}\s*([\d,]+\.\d{2})/i,
      /(?:subtotal|net\s+amount)\s*[:.-]?\s*[$€£₹A-Za-z]{0,4}\s*([\d,]+\.\d{2})/i,
    ];

    for (const p of totalLines) {
      const m = text.match(p);
      if (m && m[1]) {
        const val = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 0) {
          return { amount: val, currency };
        }
      }
    }

    // Fallback: look for largest monetary amount in the text
    const moneyMatches = text.matchAll(
      /(?:\$|USD|₹|INR|€|EUR|£|GBP)\s*([\d,]+\.\d{2})/gi,
    );
    let maxVal = 0;
    for (const match of moneyMatches) {
      if (match[1]) {
        const val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val) && val > maxVal && val < 1_000_000) {
          maxVal = val;
        }
      }
    }

    return {
      amount: maxVal > 0 ? maxVal : undefined,
      currency,
    };
  }

  private extractVendorAndCategory(text: string): {
    vendor?: string;
    categorySuggestion?: string;
  } {
    // 1. Check known vendors
    for (const vendor of KNOWN_VENDORS) {
      if (vendor.pattern.test(text)) {
        return {
          vendor: vendor.name,
          categorySuggestion: vendor.category,
        };
      }
    }

    // 2. Fallback: clean the first non-trivial line as vendor name
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length >= 3 &&
          !/^(tax\s+invoice|invoice|receipt|bill|statement|billed\s+to|customer|page)/i.test(
            l,
          ),
      );

    if (lines.length > 0) {
      const candidate = lines[0].replace(/[^a-zA-Z0-9&.\s'-]/g, '').trim();
      if (candidate.length >= 3 && candidate.length <= 40) {
        return { vendor: candidate };
      }
    }

    return {};
  }

  private async ocrPdfImages(pdfBuffer: Buffer): Promise<string> {
    const images = this.extractJpegsFromPdf(pdfBuffer);
    if (!images.length) return '';
    const parts: string[] = [];
    for (const img of images) {
      const text = await this.ocrImage(img);
      if (text.trim()) parts.push(text);
    }
    return parts.join('\n');
  }

  private extractJpegsFromPdf(pdf: Buffer): Buffer[] {
    const marker = Buffer.from([0xff, 0xd8]);
    const end = Buffer.from([0xff, 0xd9]);
    const found: Buffer[] = [];
    let start = 0;
    while (found.length < 4) {
      const soi = pdf.indexOf(marker, start);
      if (soi < 0) break;
      const eoi = pdf.indexOf(end, soi + 2);
      if (eoi < 0) break;
      const slice = pdf.subarray(soi, eoi + 2);
      if (slice.length >= 15_000) found.push(Buffer.from(slice));
      start = eoi + 2;
    }
    return found.sort((a, b) => b.length - a.length).slice(0, 2);
  }

  private async ocrImage(imageBuffer: Buffer): Promise<string> {
    return this.enqueue(async () => {
      const worker = await this.ensureWorker();
      try {
        const { data } = await worker.recognize(imageBuffer);
        return data?.text || '';
      } catch (err) {
        this.logger.warn(
          `OCR error: ${err instanceof Error ? err.message : 'unknown'}`,
        );
        return '';
      }
    });
  }

  private async ensureWorker(): Promise<Worker> {
    if (this.worker) return this.worker;
    this.worker = await createWorker('eng', 1, {
      cachePath: join(tmpdir(), 'ace-finance-tess'),
      logger: () => undefined,
    });
    return this.worker;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
