import {
  Controller,
  Get,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FxService } from './fx.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { howWhy } from '../common/swagger/api-guide';
import { ApiSopResponses } from '../common/swagger/api-sop';
import { FX_DATA } from '../common/swagger/sop-data-samples';

@ApiTags('FX')
@Controller('fx')
export class FxController {
  constructor(private readonly fxService: FxService) {}

  /** Authenticated — preview local → USD conversion using today's rate */
  @Get('convert')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Convert an amount between currencies or to USD',
    description: howWhy({
      why: 'Show converted local amounts or "≈ $15.63 USD" preview under the amount field.',
      how: "GET (Bearer) `?from=USD&to=INR&amount=184.2` or GET `?currency=INR&amount=1500`.",
    }),
  })
  @ApiQuery({ name: 'currency', required: false, example: 'INR' })
  @ApiQuery({ name: 'from', required: false, example: 'USD' })
  @ApiQuery({ name: 'to', required: false, example: 'INR' })
  @ApiQuery({ name: 'amount', required: true, example: 1500 })
  @ApiSopResponses({
    successData: FX_DATA,
    auth: true,
    badRequest: 'amount query must be a number',
  })
  async convert(
    @Query('currency') currency?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('amount') amountRaw?: string,
  ) {
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount)) {
      throw new BadRequestException('amount query must be a number');
    }
    if (from && to) {
      return this.fxService.convertBetween(from, to, amount);
    }
    const curr = currency || from || 'USD';
    return this.fxService.convertToUsd(curr, amount);
  }
}
