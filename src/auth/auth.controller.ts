import { Controller, Post, Body, UseGuards, Request, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('verify-2fa')
  async verify2fa(
    @Body() body: { challengeToken: string; code: string; method?: 'email' | 'totp' },
  ) {
    return this.authService.verifyLogin2fa(body);
  }

  @Post('resend-otp')
  async resendOtp(@Body() body: { challengeToken: string }) {
    return this.authService.resendLoginOtp(body.challengeToken);
  }

  @Get('totp/status')
  @UseGuards(JwtAuthGuard)
  async totpStatus(@Request() req: any) {
    return this.authService.getTotpStatus(req.user.userId, req.user.role);
  }

  @Post('totp/setup')
  @UseGuards(JwtAuthGuard)
  async totpSetup(@Request() req: any) {
    return this.authService.setupTotp(req.user.userId, req.user.role);
  }

  @Post('totp/enable')
  @UseGuards(JwtAuthGuard)
  async totpEnable(@Request() req: any, @Body() body: { code: string }) {
    return this.authService.enableTotp(req.user.userId, req.user.role, body.code);
  }

  @Post('totp/replace/send-code')
  @UseGuards(JwtAuthGuard)
  async totpReplaceSendCode(@Request() req: any, @Body() body: { password: string }) {
    return this.authService.requestReplaceTotp(req.user.userId, body.password);
  }

  @Post('totp/replace/setup')
  @UseGuards(JwtAuthGuard)
  async totpReplaceSetup(
    @Request() req: any,
    @Body() body: { password: string; code?: string },
  ) {
    return this.authService.startReplaceTotp(req.user.userId, body);
  }

  @Post('totp/disable/send-code')
  @UseGuards(JwtAuthGuard)
  async totpDisableSendCode(@Request() req: any, @Body() body: { password: string }) {
    return this.authService.requestDisableTotp(req.user.userId, body.password);
  }

  @Post('totp/disable')
  @UseGuards(JwtAuthGuard)
  async totpDisable(
    @Request() req: any,
    @Body() body: { password: string; code?: string },
  ) {
    return this.authService.disableTotp(req.user.userId, req.user.role, body);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req: any,
    @Body() body: { currentPassword: string; newPassword: string; confirmPassword?: string },
  ) {
    return this.authService.changePassword(
      req.user.userId,
      body.currentPassword,
      body.newPassword,
      body.confirmPassword,
    );
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  async resetPassword(
    @Body() body: { token: string; newPassword: string; confirmPassword: string },
  ) {
    return this.authService.resetPassword(body.token, body.newPassword, body.confirmPassword);
  }

  @Get('validate-reset-token')
  async validateResetToken(@Query('token') token: string) {
    return this.authService.validateResetToken(token);
  }

  // One-time seed endpoint — creates admin account if no users exist
  @Post('seed')
  async seed() {
    return this.authService.seed();
  }
}
