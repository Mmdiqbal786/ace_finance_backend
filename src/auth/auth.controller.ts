import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  PasswordConfirmDto,
  PasswordWithCodeDto,
  ResendOtpDto,
  ResetPasswordDto,
  TotpCodeDto,
  Verify2faDto,
} from './dto/auth.dto';
import { howWhy } from '../common/swagger/api-guide';
import { ApiSopResponses } from '../common/swagger/api-sop';
import {
  CHANGE_PASSWORD_EXAMPLES,
  FORGOT_PASSWORD_EXAMPLES,
  LOGIN_EXAMPLES,
  PASSWORD_CONFIRM_EXAMPLES,
  PASSWORD_WITH_CODE_EXAMPLES,
  RESEND_OTP_EXAMPLES,
  RESET_PASSWORD_EXAMPLES,
  TOTP_CODE_EXAMPLES,
  VERIFY_2FA_EXAMPLES,
} from '../common/swagger/common-examples';
import {
  EMAIL_CODE_SENT_DATA,
  LOGIN_2FA_DATA,
  LOGIN_DATA,
  TOTP_SETUP_DATA,
  TOTP_STATUS_DATA,
} from '../common/swagger/sop-data-samples';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Login with email and password',
    description: howWhy({
      why: 'Start every session — get the JWT used by all protected APIs.',
      how: 'POST `{ email, password }` → copy `access_token` → Swagger **Authorize** (Bearer).',
      when: 'App launch / before any dashboard screen.',
      extras:
        'Accounts with 2FA return `{ requires2fa: true, challengeToken }` instead — then call `POST /auth/verify-2fa`. Pick a password-only demo account from the **Examples** dropdown.',
    }),
  })
  @ApiBody({ type: LoginDto, examples: LOGIN_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: LOGIN_DATA,
    successDescription:
      'Signed in (password-only account). 2FA accounts get a challenge instead.',
    auth: 'Invalid email or password',
    badRequest: 'We could not send the verification email (SMTP error).',
  })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('verify-2fa')
  @ApiOperation({
    summary: 'Complete sign-in with email OTP or authenticator code',
    description: howWhy({
      why: 'Second step for accounts with 2FA.',
      how: 'Send the `challengeToken` from login + the 6-digit `code`. `method` is optional (`email` | `totp`).',
      when: 'Right after login returned `requires2fa: true` (challenge expires in 10 minutes).',
      extras: `Login 2FA response example:\n\`\`\`json\n${JSON.stringify(LOGIN_2FA_DATA, null, 2)}\n\`\`\``,
    }),
  })
  @ApiBody({ type: Verify2faDto, examples: VERIFY_2FA_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: LOGIN_DATA,
    auth: 'Invalid or expired verification code.',
    badRequest: 'Enter the 6-digit verification code.',
  })
  async verify2fa(@Body() body: Verify2faDto) {
    return this.authService.verifyLogin2fa(body);
  }

  @Post('resend-otp')
  @ApiOperation({
    summary: 'Resend the login email OTP',
    description: howWhy({
      why: 'User did not receive the sign-in code.',
      how: 'POST the same `challengeToken` → a new code is emailed and a fresh challenge returned.',
    }),
  })
  @ApiBody({ type: ResendOtpDto, examples: RESEND_OTP_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: LOGIN_2FA_DATA,
    auth: false,
    badRequest: 'We could not send the verification email (SMTP error).',
  })
  async resendOtp(@Body() body: ResendOtpDto) {
    return this.authService.resendLoginOtp(body.challengeToken);
  }

  @Get('totp/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Authenticator status for the signed-in user',
    description: howWhy({
      why: 'Decide which authenticator UI to show on the profile / setup screens.',
      how: 'GET with Bearer token → `enabled`, `required`, `canReplace`, `canDisable` flags.',
    }),
  })
  @ApiSopResponses({ successData: TOTP_STATUS_DATA })
  async totpStatus(@Request() req: any) {
    return this.authService.getTotpStatus(req.user.userId, req.user.role);
  }

  @Post('totp/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate authenticator QR code',
    description: howWhy({
      why: 'Enroll Google / Microsoft Authenticator (required for non-admin, non-demo users).',
      how: 'POST → render `qrCodeDataUrl` (or show `secret`) → user scans → `POST /auth/totp/enable` with a code.',
    }),
  })
  @ApiSopResponses({
    successStatus: 201,
    successData: TOTP_SETUP_DATA,
    badRequest:
      'Authenticator is already enabled. Use Change authenticator to replace it.',
  })
  async totpSetup(@Request() req: any) {
    return this.authService.setupTotp(req.user.userId, req.user.role);
  }

  @Post('totp/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confirm authenticator with a 6-digit code',
    description: howWhy({
      why: 'Finish enrolment (or replacement) by proving the app works.',
      how: 'POST `{ code }` from the authenticator app → returns a fresh `access_token` with `totpEnabled: true`.',
    }),
  })
  @ApiBody({ type: TotpCodeDto, examples: TOTP_CODE_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: {
      enabled: true,
      replaced: false,
      message: 'Authenticator app enabled. You can use it at sign-in.',
      ...LOGIN_DATA,
    },
    badRequest: 'Enter the 6-digit code from your authenticator app.',
  })
  async totpEnable(@Request() req: any, @Body() body: TotpCodeDto) {
    return this.authService.enableTotp(
      req.user.userId,
      req.user.role,
      body.code,
    );
  }

  @Post('totp/replace/send-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Email a code to change authenticator',
    description: howWhy({
      why: 'New phone / lost app — step 1 of replacing the authenticator.',
      how: 'POST `{ password }` → 6-digit code emailed → then `POST /auth/totp/replace/setup`.',
    }),
  })
  @ApiBody({ type: PasswordConfirmDto, examples: PASSWORD_CONFIRM_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: EMAIL_CODE_SENT_DATA,
    badRequest: 'Current password is incorrect.',
  })
  async totpReplaceSendCode(
    @Request() req: any,
    @Body() body: PasswordConfirmDto,
  ) {
    return this.authService.requestReplaceTotp(req.user.userId, body.password);
  }

  @Post('totp/replace/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start authenticator replacement (new QR code)',
    description: howWhy({
      why: 'Step 2 of replacing the authenticator.',
      how: 'POST `{ password, code }` (code from email) → new QR → confirm with `POST /auth/totp/enable`.',
    }),
  })
  @ApiBody({ type: PasswordWithCodeDto, examples: PASSWORD_WITH_CODE_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: { ...TOTP_SETUP_DATA, replacing: true },
    badRequest: 'Enter the 6-digit code from your email.',
  })
  async totpReplaceSetup(
    @Request() req: any,
    @Body() body: PasswordWithCodeDto,
  ) {
    return this.authService.startReplaceTotp(req.user.userId, body);
  }

  @Post('totp/disable/send-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Email a code to disable authenticator',
    description: howWhy({
      why: 'Step 1 of turning off the authenticator (admin accounts).',
      how: 'POST `{ password }` → code emailed → `POST /auth/totp/disable`.',
    }),
  })
  @ApiBody({ type: PasswordConfirmDto, examples: PASSWORD_CONFIRM_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: EMAIL_CODE_SENT_DATA,
    badRequest: 'Current password is incorrect.',
  })
  async totpDisableSendCode(
    @Request() req: any,
    @Body() body: PasswordConfirmDto,
  ) {
    return this.authService.requestDisableTotp(req.user.userId, body.password);
  }

  @Post('totp/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Disable authenticator (admin accounts only)',
    description: howWhy({
      why: 'Admins can go back to password-only sign-in.',
      how: 'POST `{ password, code }` (code from email).',
    }),
  })
  @ApiBody({ type: PasswordWithCodeDto, examples: PASSWORD_WITH_CODE_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: {
      enabled: false,
      message:
        'Authenticator app disabled. Admin sign-in is password only again.',
    },
    badRequest: 'Current password is incorrect.',
  })
  async totpDisable(@Request() req: any, @Body() body: PasswordWithCodeDto) {
    return this.authService.disableTotp(req.user.userId, req.user.role, body);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change own password',
    description: howWhy({
      why: 'Replace a temporary password (`mustChangePassword: true`) or rotate it from Profile.',
      how: 'POST current + new password → returns a fresh `access_token` (store it).',
    }),
  })
  @ApiBody({ type: ChangePasswordDto, examples: CHANGE_PASSWORD_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: LOGIN_DATA,
    badRequest: 'Current password is incorrect.',
  })
  async changePassword(@Request() req: any, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(
      req.user.userId,
      body.currentPassword,
      body.newPassword,
      body.confirmPassword,
    );
  }

  @Post('forgot-password')
  @ApiOperation({
    summary: 'Send password reset email',
    description: howWhy({
      why: 'User forgot their password.',
      how: 'POST `{ email }` → reset link emailed (same response whether or not the account exists).',
    }),
  })
  @ApiBody({ type: ForgotPasswordDto, examples: FORGOT_PASSWORD_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: {
      message:
        'If an account exists for that email, a password reset link has been sent. Please check your inbox.',
    },
    auth: false,
  })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset password with the emailed token',
    description: howWhy({
      why: 'Finish the forgot-password flow.',
      how: 'POST `{ token, newPassword, confirmPassword }` (token from the reset link).',
    }),
  })
  @ApiBody({ type: ResetPasswordDto, examples: RESET_PASSWORD_EXAMPLES })
  @ApiSopResponses({
    successStatus: 201,
    successData: {
      message: 'Your password has been updated. You can sign in now.',
    },
    auth: false,
    badRequest: 'Invalid or expired reset link. Please request a new one.',
  })
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(
      body.token,
      body.newPassword,
      body.confirmPassword,
    );
  }

  @Get('validate-reset-token')
  @ApiOperation({
    summary: 'Check whether a reset token is still valid',
    description: howWhy({
      why: 'Show "link expired" before the user types a new password.',
      how: 'GET `?token=` from the reset link → `{ valid }`.',
    }),
  })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'Token from the reset link',
  })
  @ApiSopResponses({ successData: { valid: true }, auth: false })
  async validateResetToken(@Query('token') token: string) {
    return this.authService.validateResetToken(token);
  }

  // One-time seed endpoint — creates admin account if no users exist
  @Post('seed')
  @ApiOperation({
    summary: 'Seed admin, categories, countries and demo users',
    description: howWhy({
      why: 'Bootstrap an empty database.',
      how: 'POST once on a fresh database. Safe to repeat — existing records are skipped.',
    }),
  })
  @ApiSopResponses({
    successStatus: 201,
    successData: {
      created: false,
      message: 'Users already exist. Seed skipped.',
    },
    auth: false,
  })
  async seed() {
    return this.authService.seed();
  }
}
