import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { extname } from 'path';

export type StorageFolder = 'invoices' | 'receipts';

export interface AttachmentNaming {
  expenseId: string;
  kind: 'invoice' | 'receipt';
  /** Defaults to now — used in receipt filenames */
  at?: Date;
  /** USD paid with this receipt — included in receipt filenames */
  paymentAmountUsd?: number;
}

export interface StoredAttachment {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  storage: 'azure';
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly container: ContainerClient;
  private readonly containerName: string;

  constructor(private readonly config: ConfigService) {
    const azureConn = this.config
      .get<string>('AZURE_STORAGE_CONNECTION_STRING')
      ?.trim();
    this.containerName =
      this.config.get<string>('AZURE_STORAGE_CONTAINER')?.trim() ||
      'ace-finance-files';

    if (!azureConn) {
      throw new Error(
        'Azure Blob Storage is required. Set AZURE_STORAGE_CONNECTION_STRING in .env',
      );
    }

    const service = BlobServiceClient.fromConnectionString(azureConn);
    this.container = service.getContainerClient(this.containerName);
    this.logger.log(`Azure Blob Storage (container: ${this.containerName})`);
  }

  private objectPath(folder: StorageFolder, fileName: string): string {
    return `${folder}/${fileName}`;
  }

  /** Keep keys safe for storage paths and Content-Disposition filenames. */
  static sanitizeKey(value: string, fallback = 'file'): string {
    const cleaned = String(value || '')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[_.-]+|[_.-]+$/g, '');
    return cleaned.slice(0, 48) || fallback;
  }

  /** Readable but filesystem-safe stamp, e.g. 2026-07-17_12-06-59 */
  static formatStamp(date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return [
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`,
    ].join('_');
  }

  /** e.g. 1.04USD — safe for storage object keys */
  static formatAmountUsd(amount?: number): string {
    const n = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(n)) return '0.00USD';
    return `${n.toFixed(2)}USD`;
  }

  private makeStructuredFileName(
    naming: AttachmentNaming,
    originalName: string,
  ): string {
    const expenseId = StorageService.sanitizeKey(naming.expenseId, 'EXP');
    const safeExt = extname(originalName || '').toLowerCase() || '.bin';
    const stamp = StorageService.formatStamp(naming.at || new Date());
    const uniq = Math.floor(100 + Math.random() * 900);

    if (naming.kind === 'invoice') {
      return `${expenseId}_${stamp}_${uniq}_invoice${safeExt}`;
    }

    const amount = StorageService.formatAmountUsd(naming.paymentAmountUsd);
    return `${expenseId}_${stamp}_${amount}_${uniq}_receipt${safeExt}`;
  }

  private requireBuffer(file: Express.Multer.File): Buffer {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Uploaded file is empty.');
    }
    return file.buffer;
  }

  /**
   * Upload to Azure Blob. On failure throws — caller must not write MongoDB.
   * When `naming` is provided, uses EXP-{id}_invoice|receipt style names.
   */
  async saveAttachment(
    folder: StorageFolder,
    file: Express.Multer.File,
    naming?: AttachmentNaming,
  ): Promise<StoredAttachment> {
    const buffer = this.requireBuffer(file);
    const kind =
      naming?.kind || (folder === 'invoices' ? 'invoice' : 'receipt');
    const fileName = naming
      ? this.makeStructuredFileName({ ...naming, kind }, file.originalname)
      : `${kind === 'invoice' ? 'inv' : 'rcpt'}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}${extname(file.originalname || '').toLowerCase() || '.bin'}`;

    const originalName = fileName;
    const mimeType = file.mimetype || 'application/octet-stream';
    const size = file.size || buffer.length;
    const path = this.objectPath(folder, fileName);

    try {
      const block = this.container.getBlockBlobClient(path);
      await block.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: mimeType },
      });
    } catch (err: any) {
      this.logger.error(
        `Azure upload failed (${path}): ${err?.message || err}`,
      );
      throw new ServiceUnavailableException(
        `File upload to cloud storage failed. Request was not saved. (${err?.message || err})`,
      );
    }

    return { fileName, originalName, mimeType, size, storage: 'azure' };
  }

  async readAttachment(
    folder: StorageFolder,
    fileName: string,
  ): Promise<{ buffer: Buffer }> {
    const path = this.objectPath(folder, fileName);

    try {
      const block = this.container.getBlockBlobClient(path);
      const download = await block.download(0);
      if (!download.readableStreamBody) {
        throw new Error('empty body');
      }
      const chunks: Buffer[] = [];
      for await (const chunk of download.readableStreamBody) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return { buffer: Buffer.concat(chunks) };
    } catch (err: any) {
      this.logger.warn(
        `Azure download failed (${path}): ${err?.message || err}`,
      );
      throw new NotFoundException('File not found in cloud storage.');
    }
  }

  async deleteAttachment(
    folder: StorageFolder,
    fileName?: string,
  ): Promise<void> {
    if (!fileName) return;
    const path = this.objectPath(folder, fileName);
    try {
      await this.container.getBlockBlobClient(path).deleteIfExists();
    } catch (err: any) {
      this.logger.warn(
        `Azure delete failed for ${path}: ${err?.message || err}`,
      );
    }
  }
}
