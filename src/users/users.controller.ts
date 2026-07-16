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
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  @Roles('ADMIN')
  async findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @Roles('ADMIN')
  async create(
    @Body()
    body: {
      name: string;
      email: string;
      role: 'ADMIN' | 'APPROVER' | 'PROCESSOR' | 'REQUESTER';
      password?: string;
    },
  ) {
    return this.usersService.create(body);
  }

  // Static "me" routes must be registered before ":id", otherwise Nest
  // treats "me" as an id and applies the ADMIN role guard.
  @Get('me')
  async getMe(@Request() req: any) {
    return this.usersService.getProfile(req.user.userId);
  }

  @Put('me')
  async updateMe(@Request() req: any, @Body() body: { name?: string }) {
    if (!body.name?.trim()) {
      throw new BadRequestException('Name is required.');
    }
    return this.usersService.updateOwnProfile(req.user.userId, body.name);
  }

  @Put(':id')
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      role?: 'ADMIN' | 'APPROVER' | 'PROCESSOR' | 'REQUESTER';
      isActive?: boolean;
      password?: string;
    },
  ) {
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
  async delete(@Param('id') id: string) {
    await this.usersService.delete(id);
    return { message: 'User deleted successfully' };
  }
}
