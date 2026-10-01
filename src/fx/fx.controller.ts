import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FxService } from './fx.service';
import { howWhy } from '../common/swagger/api-guide';
import { ApiSopResponses } from '../common/swagger/api-sop';
import { FX_DATA } from '../common/swagger/sop-data-samples';

@ApiTags('FX')
@Controller('fx')
export class FxController {
  constructor(private readonly fxService: FxService) {}

  /** Public — preview local → USD conversion using today's rate */
  @Get('convert')
  @ApiOperation({
    summary: 'Convert a local amount to USD (public)',
    description: howWhy({
      why: 'Show "≈ $15.63 USD" under the amount field before submitting.',
      how: "GET `?currency=INR&amount=1500` → today's rate. The same conversion is stored on submit.",
    }),
  })
  @ApiQuery({ name: 'currency', required: true, example: 'INR' })
  @ApiQuery({ name: 'amount', required: true, example: 1500 })
  @ApiSopResponses({
    successData: FX_DATA,
    auth: false,
    badRequest: 'amount query must be a number',
  })
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
