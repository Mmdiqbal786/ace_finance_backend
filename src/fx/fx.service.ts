import { Injectable, BadRequestException, Logger } from '@nestjs/common';

export interface FxConversion {
  currency: string;
  originalAmount: number;
  exchangeRate: number;
  amountUsd: number;
  rateDate: string;
}

export interface FxPairConversion {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  exchangeRate: number;
  rateDate: string;
}

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private baseCache = new Map<
    string,
    { rates: Record<string, number>; date: string; fetchedAt: number }
  >();
  private readonly CACHE_MS = 60 * 60 * 1000; // 1 hour

  async convertToUsd(
    currencyCode: string,
    originalAmount: number,
  ): Promise<FxConversion> {
    const currency = (currencyCode || '').trim().toUpperCase();
    if (!currency || !/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException(
        'A valid 3-letter currency code is required',
      );
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

    const { rate, date } = await this.getRate(currency, 'USD');
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

  async convertBetween(
    fromCurrency: string,
    toCurrency: string,
    amount: number,
  ): Promise<FxPairConversion> {
    const from = (fromCurrency || '').trim().toUpperCase();
    const to = (toCurrency || '').trim().toUpperCase();
    if (!from || !to) {
      throw new BadRequestException('from and to currency codes are required');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (from === to) {
      const rounded = Math.round(amount * 100) / 100;
      return {
        fromCurrency: from,
        toCurrency: to,
        amount: rounded,
        convertedAmount: rounded,
        exchangeRate: 1,
        rateDate: new Date().toISOString().slice(0, 10),
      };
    }

    const { rate, date } = await this.getRate(from, to);
    const convertedAmount = Math.round(amount * rate * 100) / 100;
    return {
      fromCurrency: from,
      toCurrency: to,
      amount: Math.round(amount * 100) / 100,
      convertedAmount,
      exchangeRate: rate,
      rateDate: date,
    };
  }

  private async getRate(
    from: string,
    to: string,
  ): Promise<{ rate: number; date: string }> {
    const cached = this.baseCache.get(from);
    if (
      cached &&
      Date.now() - cached.fetchedAt < this.CACHE_MS &&
      cached.rates[to]
    ) {
      return { rate: cached.rates[to], date: cached.date };
    }

    try {
      const res = await fetch(
        `https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`,
      );
      if (!res.ok) {
        throw new Error(`FX API HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        result?: string;
        rates?: Record<string, number>;
        time_last_update_utc?: string;
      };
      if (data.result !== 'success' || !data.rates) {
        throw new Error(`No rates returned for ${from}`);
      }
      const rate = Number(data.rates[to]);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error(`No exchange rate from ${from} to ${to}`);
      }
      const date =
        data.time_last_update_utc?.slice(0, 16) ||
        new Date().toISOString().slice(0, 10);
      this.baseCache.set(from, {
        rates: data.rates,
        date,
        fetchedAt: Date.now(),
      });
      return { rate, date };
    } catch (err: any) {
      this.logger.warn(
        `FX lookup failed for ${from}->${to}: ${err?.message || err}`,
      );
      throw new BadRequestException(
        `Could not fetch today's exchange rate from ${from} to ${to}. Try again shortly.`,
      );
    }
  }
}
