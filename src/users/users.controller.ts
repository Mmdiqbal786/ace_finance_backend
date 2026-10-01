import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateUserDto, UpdateMeDto, UpdateUserDto } from './dto/users.dto';
import { howWhy } from '../common/swagger/api-guide';
import { ApiSopResponses } from '../common/swagger/api-sop';
import {
  CREATE_USER_EXAMPLES,
  UPDATE_ME_EXAMPLES,
  UPDATE_USER_EXAMPLES,
} from '../common/swagger/common-examples';
import {
  PROFILE_DATA,
  USER_CREATED_DATA,
  USER_ROW,
} from '../common/swagger/sop-data-samples';

const ADMIN = ['ADMIN'];

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'List all users (ADMIN)',
    description: howWhy({
      why: 'Admin → Users table.',
      how: 'GET → array of users (password never returned).',
    }),
  })
  @ApiSopResponses({ successData: [USER_ROW], roles: ADMIN })
  async findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Create user (ADMIN)',
    description: howWhy({
      why: 'Invite a requester, approver, processor or admin.',
      how: 'POST name, email, role (+ assignedProjects for REQUESTER / APPROVER). Omit `password` to auto-generate a temporary one that is emailed.',
      extras:
        'The user must change the temporary password at first login. If the welcome email fails, `temporaryPassword` is returned so the admin can share it.',
    }),
  })
  @ApiBody({ type: CreateUserDto, examples: CREATE_USER_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: USER_CREATED_DATA,
    roles: ADMIN,
    conflict: 'User with email jane.doe@example.com already exists',
  })
  async create(@Body() body: CreateUserDto) {
    return this.usersService.create(body);
  }

  // Static "me" routes must be registered before ":id", otherwise Nest
  // treats "me" as an id and applies the ADMIN role guard.
  @Get('me')
  @ApiOperation({
    summary: 'Get own profile',
    description: howWhy({
      why: 'Profile screen / header name.',
      how: 'GET with any role.',
    }),
  })
  @ApiSopResponses({ successData: PROFILE_DATA })
  async getMe(@Request() req: any) {
    return this.usersService.getProfile(req.user.userId);
  }

  @Put('me')
  @ApiOperation({
    summary: 'Update own display name',
    description: howWhy({
      why: 'Profile → edit name.',
      how: 'PUT `{ name }` with any role.',
    }),
  })
  @ApiBody({ type: UpdateMeDto, examples: UPDATE_ME_EXAMPLES })
  @ApiSopResponses({
    successData: { ...PROFILE_DATA, name: 'Jane Doe' },
    badRequest: 'Name is required.',
    conflict: 'Name must be at least 2 characters.',
  })
  async updateMe(@Request() req: any, @Body() body: UpdateMeDto) {
    if (!body.name?.trim()) {
      throw new BadRequestException('Name is required.');
    }
    return this.usersService.updateOwnProfile(req.user.userId, body.name);
  }

  @Put(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Update user (ADMIN)',
    description: howWhy({
      why: 'Change role, projects, active flag, or reset a password.',
      how: 'PUT any subset of fields. `id` = user `_id`. A `password` here forces a change at next login.',
    }),
  })
  @ApiBody({ type: UpdateUserDto, examples: UPDATE_USER_EXAMPLES })
  @ApiSopResponses({
    successData: { ...USER_ROW, role: 'APPROVER' },
    roles: ADMIN,
    notFound: 'User 6a8d927f07ae621252b8c896 not found',
  })
  async update(@Param('id') id: string, @Body() body: UpdateUserDto) {
    const { password, ...rest } = body;
    if (password) {
      await this.usersService.updatePassword(id, password, {
        requireChangeOnNextLogin: true,
      });
    }
    if (Object.keys(rest).length > 0) {
      return this.usersService.update(id, rest);
    }
    const user = await this.usersService.findById(id);
    if (!user) return null;
    const { password: _, ...safe } = user.toObject();
    return safe;
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Delete user (ADMIN)',
    description: howWhy({
      why: 'Remove an account permanently.',
      how: 'DELETE with user `_id`.',
    }),
  })
  @ApiSopResponses({
    successData: { message: 'User deleted successfully' },
    roles: ADMIN,
    notFound: 'User 6a8d927f07ae621252b8c896 not found',
  })
  async delete(@Param('id') id: string) {
    await this.usersService.delete(id);
    return { message: 'User deleted successfully' };
  }
}
