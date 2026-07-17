import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
  storage: 'supabase';
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly supabase: SupabaseClient;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL')?.trim();
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    this.bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET')?.trim() || 'ace-finance-files';

    if (!url || !key) {
      throw new Error(
        'Supabase Storage is required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env',
      );
    }

    this.supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.logger.log(`Supabase Storage only (bucket: ${this.bucket}) — local disk disabled`);
  }

  private objectPath(folder: StorageFolder, fileName: string): string {
    return `${folder}/${fileName}`;
  }

  /** Keep keys safe for storage paths and Content-Disposition filenames. */
  static sanitizeKey(value: string, fallback = 'user'): string {
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

  private makeStructuredFileName(naming: AttachmentNaming, originalName: string): string {
    const expenseId = StorageService.sanitizeKey(naming.expenseId, 'EXP');
    const safeExt = extname(originalName || '').toLowerCase() || '.bin';

    if (naming.kind === 'invoice') {
      return `${expenseId}_invoice${safeExt}`;
    }

    const stamp = StorageService.formatStamp(naming.at || new Date());
    const amount = StorageService.formatAmountUsd(naming.paymentAmountUsd);
    const uniq = Math.floor(100 + Math.random() * 900);
    return `${expenseId}_${stamp}_${amount}_${uniq}_receipt${safeExt}`;
  }

  private requireBuffer(file: Express.Multer.File): Buffer {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Uploaded file is empty.');
    }
    return file.buffer;
  }

  /**
   * Upload to Supabase only. On failure throws — caller must not write MongoDB.
   * When `naming` is provided, uses EXP-{id}_invoice|receipt style names.
   */
  async saveAttachment(
    folder: StorageFolder,
    file: Express.Multer.File,
    naming?: AttachmentNaming,
  ): Promise<StoredAttachment> {
    const buffer = this.requireBuffer(file);
    const kind = naming?.kind || (folder === 'invoices' ? 'invoice' : 'receipt');
    const fileName = naming
      ? this.makeStructuredFileName({ ...naming, kind }, file.originalname)
      : `${kind === 'invoice' ? 'inv' : 'rcpt'}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}${extname(file.originalname || '').toLowerCase() || '.bin'}`;

    // Display name matches storage name (structured), not the uploader's original filename.
    const originalName = fileName;
    const mimeType = file.mimetype || 'application/octet-stream';
    const size = file.size || buffer.length;
    const path = this.objectPath(folder, fileName);

    const { error } = await this.supabase.storage.from(this.bucket).upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });

    if (error) {
      this.logger.error(`Supabase upload failed (${path}): ${error.message}`);
      throw new ServiceUnavailableException(
        `File upload to cloud storage failed. Request was not saved. (${error.message})`,
      );
    }

    return { fileName, originalName, mimeType, size, storage: 'supabase' };
  }

  async readAttachment(
    folder: StorageFolder,
    fileName: string,
  ): Promise<{ buffer: Buffer }> {
    const path = this.objectPath(folder, fileName);
    const { data, error } = await this.supabase.storage.from(this.bucket).download(path);

    if (error || !data) {
      this.logger.warn(`Supabase download failed (${path}): ${error?.message || 'not found'}`);
      throw new NotFoundException('File not found in cloud storage.');
    }

    const arrayBuffer = await data.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer) };
  }

  async deleteAttachment(folder: StorageFolder, fileName?: string): Promise<void> {
    if (!fileName) return;
    const path = this.objectPath(folder, fileName);
    const { error } = await this.supabase.storage.from(this.bucket).remove([path]);
    if (error) {
      this.logger.warn(`Supabase delete failed for ${path}: ${error.message}`);
    }
  }
}
