import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import { InvoiceParseService } from './invoice-parse.service';

describe('InvoiceParseService', () => {
  let service: InvoiceParseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvoiceParseService],
    }).compile();

    service = module.get<InvoiceParseService>(InvoiceParseService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should extract invoice details from a sample PDF invoice using pdf-parse', async () => {
    const pdfPath = path.resolve(
      __dirname,
      '../../../invoice-sample/samples/AWS_Cloud_Hosting_INV-8819.pdf',
    );
    if (!fs.existsSync(pdfPath)) {
      // Fallback skip if sample path moved
      return;
    }

    const buffer = fs.readFileSync(pdfPath);
    const result = await service.parse(
      buffer,
      'AWS_Cloud_Hosting_INV-8819.pdf',
      'application/pdf',
    );

    expect(result.parseMethod).toBe('pdf-parse');
    expect(result.invoiceNumber).toBe('INV-AWS-2026-8819');
    expect(result.invoiceDate).toBe('2026-10-01');
    expect(result.amount).toBe(1240);
    expect(result.currency).toBe('USD');
    expect(result.vendor).toBe('Amazon Web Services');
  });

  it('should extract details from Dell Hardware invoice', async () => {
    const pdfPath = path.resolve(
      __dirname,
      '../../../invoice-sample/samples/Dell_Hardware_INV-04192.pdf',
    );
    if (!fs.existsSync(pdfPath)) return;

    const buffer = fs.readFileSync(pdfPath);
    const result = await service.parse(
      buffer,
      'Dell_Hardware_INV-04192.pdf',
      'application/pdf',
    );

    expect(result.parseMethod).toBe('pdf-parse');
    expect(result.invoiceNumber).toBe('DELL-2026-04192');
    expect(result.invoiceDate).toBe('2026-10-05');
    expect(result.amount).toBe(2499);
  });

  it('should gracefully handle empty buffer without throwing', async () => {
    const emptyBuf = Buffer.from('');
    const result = await service.parse(
      emptyBuf,
      'empty.pdf',
      'application/pdf',
    );

    expect(result.parseMethod).toBe('none');
    expect(result.invoiceNumber).toBeUndefined();
    expect(result.amount).toBeUndefined();
  });

  it('should extract details from an image receipt using OCR flow', async () => {
    jest.spyOn(service as any, 'ocrImage').mockResolvedValue(`
      Uber
      Thursday, October 08, 2026
      Receipt ID: UBR-90214-TRIP
      Trip fare: $36.50
      TOTAL: $36.50 USD
    `);

    const fakeImageBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]); // PNG header
    const result = await service.parse(
      fakeImageBuffer,
      'Uber_Receipt_UBR-90214.png',
      'image/png',
    );

    expect(result.parseMethod).toBe('tesseract-ocr');
    expect(result.invoiceNumber).toBe('UBR-90214-TRIP');
    expect(result.invoiceDate).toBe('2026-10-08');
    expect(result.amount).toBe(36.5);
    expect(result.vendor).toBe('Uber');
  });
});
