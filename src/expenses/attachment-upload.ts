import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import { extname } from 'path';

export const ALLOWED_ATTACHMENT_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const ALLOWED_ATTACHMENT_EXT = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
]);

export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

/** Memory storage — files are persisted by StorageService (Supabase or local disk). */
export function attachmentMulterOptions(kind: 'invoice' | 'receipt') {
  return {
    storage: memoryStorage(),
    limits: { fileSize: ATTACHMENT_MAX_BYTES },
    fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
      const ext = extname(file.originalname || '').toLowerCase();
      if (!ALLOWED_ATTACHMENT_MIME.has(file.mimetype) || !ALLOWED_ATTACHMENT_EXT.has(ext)) {
        return cb(
          new BadRequestException(
            `${kind === 'invoice' ? 'Invoice' : 'Payment receipt'} must be a PDF or image (JPG, PNG, WEBP, GIF), max 5 MB.`,
          ) as any,
          false,
        );
      }
      cb(null, true);
    },
  };
}
