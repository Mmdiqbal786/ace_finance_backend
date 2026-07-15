import { Injectable, BadRequestException, Logger } from '@nestjs/common';

export interface FxConversion {
  currency: string;
  originalAmount: number;
  exchangeRate: number;
  amountUsd: number;
  rateDate: string;
}

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private cache = new Map<string, { rate: number; date: string; fetchedAt: number }>();
  private readonly CACHE_MS = 60 * 60 * 1000; // 1 hour

  async convertToUsd(
    currencyCode: string,
    originalAmount: number,
  ): Promise<FxConversion> {
    const currency = (currencyCode || '').trim().toUpperCase();
    if (!currency || !/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException('A valid 3-letter currency code is required');
    }
    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (currency === 'USD') {
      const amountUsd = Math.round(originalAmount * 100) / 100;
      return {
        currency,
        originalAmount: amountUsd,
        exchangeRate: 1,
        amountUsd,
        rateDate: new Date().toISOString().slice(0, 10),
      };
    }

    const { rate, date } = await this.getUsdRate(currency);
    const amountUsd = Math.round(originalAmount * rate * 100) / 100;
    if (amountUsd < 1) {
      throw new BadRequestException(
        'Converted USD amount must be at least $1.00. Increase the local amount.',
      );
    }
    if (amountUsd > 100_000) {
      throw new BadRequestException(
        'Converted USD amount cannot exceed $100,000.00.',
      );
    }

    return {
      currency,
      originalAmount: Math.round(originalAmount * 100) / 100,
      exchangeRate: rate,
      amountUsd,
      rateDate: date,
    };
  }

  private async getUsdRate(
    currency: string,
  ): Promise<{ rate: number; date: string }> {
    const cached = this.cache.get(currency);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_MS) {
      return { rate: cached.rate, date: cached.date };
    }

    try {
      const res = await fetch(
        `https://open.er-api.com/v6/latest/${encodeURIComponent(currency)}`,
      );
      if (!res.ok) {
        throw new Error(`FX API HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        result?: string;
        rates?: Record<string, number>;
        time_last_update_utc?: string;
      };
      if (data.result !== 'success' || !data.rates?.USD) {
        throw new Error(`No USD rate for ${currency}`);
      }
      const rate = Number(data.rates.USD);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error(`Invalid USD rate for ${currency}`);
      }
      const date =
        data.time_last_update_utc?.slice(0, 16) ||
        new Date().toISOString().slice(0, 10);
      this.cache.set(currency, { rate, date, fetchedAt: Date.now() });
      return { rate, date };
    } catch (err: any) {
      this.logger.warn(`FX lookup failed for ${currency}: ${err?.message || err}`);
      throw new BadRequestException(
        `Could not fetch today's exchange rate for ${currency}. Try again shortly.`,
      );
    }
  }
}
