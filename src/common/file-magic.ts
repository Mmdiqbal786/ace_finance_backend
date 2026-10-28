import { BadRequestException } from '@nestjs/common';

/** Verify buffer magic bytes match declared MIME / extension class. */
export function assertAttachmentMagic(
  buffer: Buffer | undefined,
  mimeType: string,
  kind: 'invoice' | 'receipt' = 'invoice',
): void {
  if (!buffer || buffer.length < 12) {
    throw new BadRequestException(
      `${kind === 'invoice' ? 'Invoice' : 'Payment receipt'} file is empty or too small.`,
    );
  }

  const mime = (mimeType || '').toLowerCase();
  const label = kind === 'invoice' ? 'Invoice' : 'Payment receipt';

  const isPdf =
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46; // %PDF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isGif =
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38;
  const isWebp =
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP';

  let ok = false;
  if (mime === 'application/pdf') ok = isPdf;
  else if (mime === 'image/jpeg') ok = isJpeg;
  else if (mime === 'image/png') ok = isPng;
  else if (mime === 'image/gif') ok = isGif;
  else if (mime === 'image/webp') ok = isWebp;
  else ok = isPdf || isJpeg || isPng || isGif || isWebp;

  if (!ok) {
    throw new BadRequestException(
      `${label} content does not match a PDF or image (JPG, PNG, WEBP, GIF).`,
    );
  }
}
