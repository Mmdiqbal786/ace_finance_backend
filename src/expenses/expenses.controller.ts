import {
  Controller, Get, Post, Patch, Put, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  // Public — no auth required (submitted by public users)
  @Post()
  async create(
    @Body()
    body: {
      requesterName: string;
      requesterEmail: string;
      originalAmount: number;
      country: string;
      category: string;
      project: string;
      description: string;
      date: string;
      dueDate: string;
    },
  ) {
    return this.expensesService.create(body);
  }

  // Public — allow status tracking by email without login
  @Get()
  async findAll(@Query('email') email?: string) {
    const expenses = await this.expensesService.findAll();
    if (email) {
      return expenses.filter((e) => e.requesterEmail.toLowerCase() === email.toLowerCase());
    }
    return expenses;
  }

  // Protected — dashboard stats
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    return this.expensesService.getStats();
  }

  // Public — allow status tracking by ID
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  // APPROVER or ADMIN only
  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('APPROVER', 'ADMIN')
  async approve(@Param('id') id: string, @Body('notes') notes: string, @Request() req: any) {
    return this.expensesService.approve(id, notes, req.user);
  }

  // APPROVER or ADMIN only
  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('APPROVER', 'ADMIN')
  async reject(@Param('id') id: string, @Body('notes') notes: string, @Request() req: any) {
    return this.expensesService.reject(id, notes, req.user);
  }

  // PROCESSOR or ADMIN only
  @Patch(':id/process')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROCESSOR', 'ADMIN')
  async process(@Param('id') id: string, @Body('notes') notes: string, @Request() req: any) {
    return this.expensesService.process(id, notes, req.user);
  }

  // PROCESSOR or ADMIN only — record a partial payout
  @Patch(':id/partial-pay')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROCESSOR', 'ADMIN')
  async partialPay(
    @Param('id') id: string,
    @Body() body: { amount: number; notes?: string },
    @Request() req: any,
  ) {
    return this.expensesService.partialPay(id, body.amount, body.notes, req.user);
  }

  // PROCESSOR or ADMIN only
  @Patch(':id/processor-reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROCESSOR', 'ADMIN')
  async processorReject(@Param('id') id: string, @Body('notes') notes: string, @Request() req: any) {
    return this.expensesService.processorReject(id, notes, req.user);
  }

  // APPROVER, PROCESSOR, or ADMIN
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('APPROVER', 'PROCESSOR', 'ADMIN')
  async update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.expensesService.update(id, body, req.user);
  }

  // ADMIN only
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'APPROVER', 'PROCESSOR')
  async delete(@Param('id') id: string) {
    return this.expensesService.delete(id);
  }
}
