import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CountriesService } from './countries.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateCountryDto, UpdateCountryDto } from '../common/dto/catalog.dto';
import { howWhy } from '../common/swagger/api-guide';
import { ApiSopResponses } from '../common/swagger/api-sop';
import {
  CREATE_COUNTRY_EXAMPLES,
  UPDATE_COUNTRY_EXAMPLES,
} from '../common/swagger/common-examples';
import { COUNTRY_ROW } from '../common/swagger/sop-data-samples';

const ADMIN = ['ADMIN'];
const NOT_FOUND = `Country ${COUNTRY_ROW._id} not found`;

@ApiTags('Countries')
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get('active')
  @ApiOperation({
    summary: 'Active countries with currency (public)',
    description: howWhy({
      why: 'Country dropdown — its `currency` drives the USD conversion.',
      how: 'GET (no auth) → send the country `name` on POST /expenses; use `currency` for GET /fx/convert.',
    }),
  })
  @ApiSopResponses({ successData: [COUNTRY_ROW], auth: false })
  async findActive() {
    return this.countriesService.findActive();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'All countries incl. inactive (ADMIN)',
    description: howWhy({
      why: 'Admin → Countries table.',
      how: 'GET → active + inactive.',
    }),
  })
  @ApiSopResponses({ successData: [COUNTRY_ROW], roles: ADMIN })
  async findAll() {
    return this.countriesService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create country (ADMIN)',
    description: howWhy({
      why: 'Allow expenses in a new country / currency.',
      how: 'POST `{ name, currency }` — currency is a 3-letter ISO code (USD, INR, AED).',
    }),
  })
  @ApiBody({ type: CreateCountryDto, examples: CREATE_COUNTRY_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: COUNTRY_ROW,
    roles: ADMIN,
    badRequest: 'Currency must be a 3-letter code like USD, INR, or AED',
    conflict: `Country "${COUNTRY_ROW.name}" already exists`,
  })
  async create(@Body() body: CreateCountryDto) {
    return this.countriesService.create(body);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update country (ADMIN)',
    description: howWhy({
      why: 'Rename, change currency or deactivate.',
      how: 'PUT any subset of `{ name, currency, isActive }`. `id` = country `_id`.',
    }),
  })
  @ApiBody({ type: UpdateCountryDto, examples: UPDATE_COUNTRY_EXAMPLES })
  @ApiSopResponses({
    successData: COUNTRY_ROW,
    roles: ADMIN,
    badRequest: 'Currency must be a 3-letter code like USD, INR, or AED',
    notFound: NOT_FOUND,
    conflict: `Country "${COUNTRY_ROW.name}" already exists`,
  })
  async update(@Param('id') id: string, @Body() body: UpdateCountryDto) {
    return this.countriesService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete country (ADMIN)',
    description: howWhy({
      why: 'Remove a country created by mistake.',
      how: 'DELETE with country `_id`. Prefer deactivating if expenses already use it.',
    }),
  })
  @ApiSopResponses({
    successData: { message: 'Country deleted successfully' },
    roles: ADMIN,
    notFound: NOT_FOUND,
  })
  async delete(@Param('id') id: string) {
    await this.countriesService.delete(id);
    return { message: 'Country deleted successfully' };
  }
}
