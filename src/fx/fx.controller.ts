import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { FxService } from './fx.service';

@Controller('fx')
export class FxController {
  constructor(private readonly fxService: FxService) {}

  /** Public — preview local → USD conversion using today's rate */
  @Get('convert')
  async convert(
    @Query('currency') currency: string,
    @Query('amount') amountRaw: string,
  ) {
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount)) {
      throw new BadRequestException('amount query must be a number');
    }
    return this.fxService.convertToUsd(currency, amount);
  }
}
