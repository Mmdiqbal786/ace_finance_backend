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
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../common/dto/catalog.dto';
import { howWhy } from '../common/swagger/api-guide';
import { ApiSopResponses } from '../common/swagger/api-sop';
import {
  CREATE_CATEGORY_EXAMPLES,
  UPDATE_CATEGORY_EXAMPLES,
} from '../common/swagger/common-examples';
import { CATEGORY_ROW } from '../common/swagger/sop-data-samples';

const ADMIN = ['ADMIN'];
const NOT_FOUND = `Category ${CATEGORY_ROW._id} not found`;

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // Public — expense form & dashboard edit dropdowns
  @Get('active')
  @ApiOperation({
    summary: 'Active categories (public)',
    description: howWhy({
      why: 'Category dropdown on the expense form.',
      how: 'GET (no auth) → show `icon` + `label`, send `name` on POST /expenses.',
    }),
  })
  @ApiSopResponses({ successData: [CATEGORY_ROW], auth: false })
  async findActive() {
    return this.categoriesService.findActive();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'All categories incl. inactive (ADMIN)',
    description: howWhy({
      why: 'Admin → Categories table.',
      how: 'GET → active + inactive.',
    }),
  })
  @ApiSopResponses({ successData: [CATEGORY_ROW], roles: ADMIN })
  async findAll() {
    return this.categoriesService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create category (ADMIN)',
    description: howWhy({
      why: 'Add an expense category.',
      how: 'POST `{ name, label, icon? }`.',
    }),
  })
  @ApiBody({ type: CreateCategoryDto, examples: CREATE_CATEGORY_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: CATEGORY_ROW,
    roles: ADMIN,
    badRequest: 'Name and label are required',
    conflict: `Category "${CATEGORY_ROW.name}" already exists`,
  })
  async create(@Body() body: CreateCategoryDto) {
    return this.categoriesService.create(body);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update category (ADMIN)',
    description: howWhy({
      why: 'Rename, relabel, change icon or deactivate.',
      how: 'PUT any subset of fields. `id` = category `_id`.',
    }),
  })
  @ApiBody({ type: UpdateCategoryDto, examples: UPDATE_CATEGORY_EXAMPLES })
  @ApiSopResponses({
    successData: CATEGORY_ROW,
    roles: ADMIN,
    badRequest: 'Label cannot be empty',
    notFound: NOT_FOUND,
    conflict: `Category "${CATEGORY_ROW.name}" already exists`,
  })
  async update(@Param('id') id: string, @Body() body: UpdateCategoryDto) {
    return this.categoriesService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete category (ADMIN)',
    description: howWhy({
      why: 'Remove a category created by mistake.',
      how: 'DELETE with category `_id`. Prefer deactivating if expenses already use it.',
    }),
  })
  @ApiSopResponses({
    successData: { message: 'Category deleted successfully' },
    roles: ADMIN,
    notFound: NOT_FOUND,
  })
  async delete(@Param('id') id: string) {
    await this.categoriesService.delete(id);
    return { message: 'Category deleted successfully' };
  }
}
