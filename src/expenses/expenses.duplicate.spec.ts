import { BadRequestException } from '@nestjs/common';
import { normalizeInvoiceNumber, escapeRegex } from './expense.schema';
import { ExpensesService } from './expenses.service';

describe('Duplicate Prevention Mechanisms', () => {
  describe('normalizeInvoiceNumber', () => {
    it('should normalize uppercase, lowercase, spaces, and punctuation', () => {
      expect(normalizeInvoiceNumber('INV-2024-001')).toBe('inv2024001');
      expect(normalizeInvoiceNumber('  inv # 2024 / 001  ')).toBe('inv2024001');
      expect(normalizeInvoiceNumber('BILL_9988_XY')).toBe('bill9988xy');
    });

    it('should return undefined for empty, falsy, or whitespace-only inputs', () => {
      expect(normalizeInvoiceNumber(undefined)).toBeUndefined();
      expect(normalizeInvoiceNumber('')).toBeUndefined();
      expect(normalizeInvoiceNumber('   ')).toBeUndefined();
    });

    it('should return undefined for generic placeholder values like N/A or None', () => {
      expect(normalizeInvoiceNumber('N/A')).toBeUndefined();
      expect(normalizeInvoiceNumber('n/a')).toBeUndefined();
      expect(normalizeInvoiceNumber('NA')).toBeUndefined();
      expect(normalizeInvoiceNumber('None')).toBeUndefined();
      expect(normalizeInvoiceNumber('0')).toBeUndefined();
      expect(normalizeInvoiceNumber('Not Applicable')).toBeUndefined();
      expect(normalizeInvoiceNumber('pending')).toBeUndefined();
    });

    it('should return undefined for strings shorter than 2 alphanumeric chars', () => {
      expect(normalizeInvoiceNumber('1')).toBeUndefined();
      expect(normalizeInvoiceNumber('-')).toBeUndefined();
    });
  });

  describe('escapeRegex', () => {
    it('should escape special regex characters properly', () => {
      expect(escapeRegex('INV-100(A)*')).toBe('INV\\-100\\(A\\)\\*');
    });
  });

  describe('ExpensesService.assertNotDuplicate', () => {
    let service: ExpensesService;
    let mockExpenseModel: any;

    beforeEach(() => {
      mockExpenseModel = {
        findOne: jest.fn(),
      };

      service = new ExpensesService(
        mockExpenseModel,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
    });

    it('should throw BadRequestException when identical fileHash exists', async () => {
      mockExpenseModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          id: 'EXP-1001',
          project: 'Google News Lab (GNL)',
          requesterName: 'Alice Smith',
          submittedAt: '2026-10-01T10:00:00Z',
        }),
      });

      await expect(
        service.assertNotDuplicate({
          fileHash:
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          project: 'Google News Lab (GNL)',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockExpenseModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          status: { $nin: ['REJECTED_APPROVER', 'REJECTED_PROCESSOR'] },
          invoiceFileHash:
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        }),
      );
    });

    it('should throw BadRequestException when invoiceNumber matches in the same project', async () => {
      // First call for hash returns null, second call for invoice number in project finds match
      mockExpenseModel.findOne
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(null),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue({
            id: 'EXP-2002',
            project: 'Google News Lab (GNL)',
            requesterName: 'Bob Jones',
            invoiceNumber: 'INV-5566',
          }),
        });

      await expect(
        service.assertNotDuplicate({
          invoiceNumber: 'INV-5566',
          fileHash: 'unique-hash-123',
          project: 'Google News Lab (GNL)',
        }),
      ).rejects.toThrow(/Duplicate invoice number detected/);
    });

    it('should throw BadRequestException when invoiceNumber matches across projects with same amount', async () => {
      // First call for hash -> null
      // Second call for same project -> null
      // Third call for cross-project with matching amount -> match found!
      mockExpenseModel.findOne
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(null),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(null),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue({
            id: 'EXP-3003',
            project: 'YouTube Creators',
            requesterName: 'Charlie Brown',
            invoiceNumber: 'INV-9900',
          }),
        });

      await expect(
        service.assertNotDuplicate({
          invoiceNumber: 'INV-9900',
          fileHash: 'unique-hash-456',
          project: 'Google News Lab (GNL)',
          originalAmount: 1500,
        }),
      ).rejects.toThrow(/Duplicate invoice detected/);
    });

    it('should pass cleanly when neither fileHash nor invoiceNumber collide', async () => {
      mockExpenseModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.assertNotDuplicate({
          invoiceNumber: 'INV-FRESH-123',
          fileHash: 'completely-fresh-hash',
          project: 'Google News Lab (GNL)',
          originalAmount: 500,
          invoiceDate: '2026-10-09',
        }),
      ).resolves.toBeUndefined();
    });

    it('should throw BadRequestException when extractedInvoiceNumber matches an existing invoice', async () => {
      mockExpenseModel.findOne
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(null),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue({
            id: 'EXP-4004',
            project: 'Android Enterprise',
            requesterName: 'Dave Lee',
            extractedInvoiceNumber: 'INV-AWS-2026-8819',
          }),
        });

      await expect(
        service.assertNotDuplicate({
          extractedInvoiceNumber: 'INV-AWS-2026-8819',
          fileHash: 'fresh-file-hash',
          project: 'Android Enterprise',
        }),
      ).rejects.toThrow(/Duplicate invoice detected via document parse/);
    });

    it('should exclude excludeExpenseId from query when editing self', async () => {
      mockExpenseModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await service.assertNotDuplicate({
        invoiceNumber: 'INV-MINE-01',
        fileHash: 'hash-of-file',
        excludeExpenseId: 'EXP-SELF-99',
      });

      expect(mockExpenseModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          id: { $ne: 'EXP-SELF-99' },
        }),
      );
    });
  });

  describe('ExpensesService.checkPotentialDuplicate (Fuzzy Triple)', () => {
    let service: ExpensesService;
    let mockExpenseModel: any;

    beforeEach(() => {
      mockExpenseModel = {
        findOne: jest.fn(),
      };

      service = new ExpensesService(
        mockExpenseModel,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
    });

    it('should detect potential duplicate when project, category, amount, and date window match', async () => {
      mockExpenseModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          id: 'EXP-MEAL-88',
          project: 'YouTube Creators',
          category: 'Meals & Entertainment',
          originalAmount: 78.08,
          currency: 'USD',
          date: '2026-10-09',
          requesterName: 'Alice Morgan',
          submittedAt: '2026-10-09T10:00:00Z',
        }),
      });

      const result = await service.checkPotentialDuplicate({
        project: 'YouTube Creators',
        category: 'Meals & Entertainment',
        originalAmount: 78.08,
        date: '2026-10-09',
      });

      expect(result.isPotentialDuplicate).toBe(true);
      expect(result.conflict?.id).toBe('EXP-MEAL-88');
      expect(result.conflict?.reason).toContain('Alice Morgan');
      expect(mockExpenseModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          project: 'YouTube Creators',
          category: 'Meals & Entertainment',
          originalAmount: 78.08,
        }),
      );
    });

    it('should differentiate identical amounts in different currencies (e.g. 1000 AFN vs 1000 AUD)', async () => {
      mockExpenseModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.checkPotentialDuplicate({
        project: 'Community Grants',
        category: 'Travel & Lodging',
        originalAmount: 1000,
        currency: 'AFN',
        date: '2026-10-09',
      });

      expect(result.isPotentialDuplicate).toBe(false);
      expect(mockExpenseModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          project: 'Community Grants',
          category: 'Travel & Lodging',
          originalAmount: 1000,
          currency: 'AFN',
        }),
      );
    });

    it('should return false when no similar expense exists', async () => {
      mockExpenseModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.checkPotentialDuplicate({
        project: 'YouTube Creators',
        category: 'Meals & Entertainment',
        originalAmount: 12.5,
        date: '2026-10-09',
      });

      expect(result.isPotentialDuplicate).toBe(false);
      expect(result.conflict).toBeUndefined();
    });
  });
});
