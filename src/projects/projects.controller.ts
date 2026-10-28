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
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateProjectDto, UpdateProjectDto } from '../common/dto/catalog.dto';
import { howWhy } from '../common/swagger/api-guide';
import { ApiSopResponses } from '../common/swagger/api-sop';
import {
  CREATE_PROJECT_EXAMPLES,
  UPDATE_PROJECT_EXAMPLES,
} from '../common/swagger/common-examples';
import { PROJECT_ROW } from '../common/swagger/sop-data-samples';

const ADMIN = ['ADMIN'];
const NOT_FOUND = `Project ${PROJECT_ROW._id} not found`;

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // Authenticated — expense form & dashboard edit dropdowns
  @Get('active')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Active projects',
    description: howWhy({
      why: 'Project dropdown on the expense form and dashboard edit.',
      how: 'GET (Bearer) → send the project `name` on POST /expenses.',
    }),
  })
  @ApiSopResponses({ successData: [PROJECT_ROW], auth: true })
  async findActive() {
    return this.projectsService.findActive();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'All projects incl. inactive (ADMIN)',
    description: howWhy({
      why: 'Admin → Projects table.',
      how: 'GET → active + inactive.',
    }),
  })
  @ApiSopResponses({ successData: [PROJECT_ROW], roles: ADMIN })
  async findAll() {
    return this.projectsService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create project (ADMIN)',
    description: howWhy({
      why: 'Add a project requesters can submit against.',
      how: 'POST `{ name }` → `code` (ACE-PR-xxxxxx) is generated automatically.',
    }),
  })
  @ApiBody({ type: CreateProjectDto, examples: CREATE_PROJECT_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: PROJECT_ROW,
    roles: ADMIN,
    badRequest: 'Name is required',
    conflict: `Project "${PROJECT_ROW.name}" already exists`,
  })
  async create(@Body() body: CreateProjectDto) {
    return this.projectsService.create({ name: body.name });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update project (ADMIN)',
    description: howWhy({
      why: 'Rename or deactivate a project.',
      how: 'PUT any subset of `{ name, isActive }`. `id` = project `_id`.',
    }),
  })
  @ApiBody({ type: UpdateProjectDto, examples: UPDATE_PROJECT_EXAMPLES })
  @ApiSopResponses({
    successData: PROJECT_ROW,
    roles: ADMIN,
    badRequest: 'Name cannot be empty',
    notFound: NOT_FOUND,
    conflict: `Project "${PROJECT_ROW.name}" already exists`,
  })
  async update(@Param('id') id: string, @Body() body: UpdateProjectDto) {
    return this.projectsService.update(id, {
      name: body.name,
      isActive: body.isActive,
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete project (ADMIN)',
    description: howWhy({
      why: 'Remove a project created by mistake.',
      how: 'DELETE with project `_id`. Prefer deactivating (isActive=false) if expenses already use it.',
    }),
  })
  @ApiSopResponses({
    successData: { message: 'Project deleted successfully' },
    roles: ADMIN,
    notFound: NOT_FOUND,
  })
  async delete(@Param('id') id: string) {
    await this.projectsService.delete(id);
    return { message: 'Project deleted successfully' };
  }
}
