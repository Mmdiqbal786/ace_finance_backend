import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Query,
  Res,
  Headers,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { MicrosoftAuthService } from './microsoft-auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  assertDemoAccessCode,
  assertSeedSecret,
  readDemoAccessCode,
} from './demo-access.util';
import {
  clearAccessCookie,
  maybeAttachAccessCookie,
} from './auth-cookie.util';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  DemoLoginDto,
  VerifyDemoAccessDto,
  LoginDto,
  PasswordConfirmDto,
  PasswordWithCodeDto,
  ResendOtpDto,
  ResetPasswordDto,
  SelectWorkspaceDto,
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
import { withDemoScope } from '../common/store/demo-scope';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly microsoftAuth: MicrosoftAuthService,
  ) {}

  @Get('microsoft/status')
  @ApiOperation({
    summary: 'Whether Microsoft sign-in is configured',
    description: howWhy({
      why: 'Show or hide the Sign in with Microsoft button.',
      how: 'GET → `{ configured, enabled, allowedEmailDomains }`. Default allows every `@aceolution.*` domain.',
    }),
  })
  @ApiSopResponses({
    successData: {
      configured: true,
      enabled: true,
      allowedEmailDomain: 'aceolution.*',
      allowedEmailDomains: ['aceolution.*'],
      azureAdGroupRoles: false,
    },
    auth: false,
  })
  microsoftStatus() {
    return this.microsoftAuth.status();
  }

  @Get('microsoft/login')
  @ApiOperation({
    summary: 'Start Microsoft sign-in',
    description: howWhy({
      why: 'Company Microsoft / Entra login (same pattern as ACE Outsource).',
      how: 'Browser GET → 302 to login.microsoftonline.com. After success Microsoft returns to /auth/microsoft/callback.',
    }),
  })
  microsoftLogin(@Res() res: Response) {
    try {
      const { url } = this.microsoftAuth.buildAuthorizeUrl();
      return res.redirect(HttpStatus.FOUND, url);
    } catch (err: any) {
      const frontend = this.microsoftAuth.frontendUrl();
      const message =
        err?.message ||
        'Microsoft login is not configured. Ask an admin to set Azure app credentials.';
      return res.redirect(
        HttpStatus.FOUND,
        `${frontend}/login/?ms_error=${encodeURIComponent(message)}`,
      );
    }
  }

  @Get('microsoft/callback')
  @ApiOperation({
    summary: 'Microsoft OAuth callback',
    description: howWhy({
      why: 'Finish Microsoft sign-in and open the Ace Finance dashboard.',
      how: 'Microsoft redirects here with `code` + `state`. Backend issues the app JWT and redirects to the web login page with tokens in the URL **hash** (not query) so proxies/logs do not capture them.',
    }),
  })
  async microsoftCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    const frontend = this.microsoftAuth.frontendUrl();
    const fail = (message: string) =>
      res.redirect(
        HttpStatus.FOUND,
        `${frontend}/login/?ms_error=${encodeURIComponent(message)}`,
      );

    if (error) {
      return fail(errorDescription || error);
    }
    if (!code || !state) {
      return fail('Microsoft did not return a login code.');
    }

    try {
      // Resolve Microsoft user in live DB; dual-store users then pick Live or Demo.
      const session = await withDemoScope(false, async () => {
        const user = await this.microsoftAuth.handleCallback(code, state);
        return this.authService.issueMicrosoftSession(user);
      });
      if (
        session &&
        typeof session === 'object' &&
        'requiresWorkspaceChoice' in session &&
        (session as { requiresWorkspaceChoice?: boolean }).requiresWorkspaceChoice
      ) {
        const choice = session as {
          workspaceToken: string;
          name?: string;
          emailHint?: string;
          workspaces?: Array<{ id: string; role?: string }>;
        };
        const params = new URLSearchParams({
          ms_workspace: choice.workspaceToken,
        });
        if (choice.name) params.set('ms_name', choice.name);
        if (choice.emailHint) params.set('ms_email', choice.emailHint);
        const liveRole = choice.workspaces?.find((w) => w.id === 'live')?.role;
        const demoRole = choice.workspaces?.find((w) => w.id === 'demo')?.role;
        if (liveRole) params.set('ms_live_role', liveRole);
        if (demoRole) params.set('ms_demo_role', demoRole);
        // Hash fragment is not sent to servers / access logs
        return res.redirect(
          HttpStatus.FOUND,
          `${frontend}/login/#${params.toString()}`,
        );
      }
      const accessToken = (session as { access_token?: string }).access_token;
      if (!accessToken) {
        return fail('Microsoft sign-in did not return a session. Try again.');
      }
      // Cookie for same-site / future proxy setups + hash token for cross-site SWA→API
      // (third-party cookies are often blocked; FE stores hash token in sessionStorage).
      maybeAttachAccessCookie(res, { access_token: accessToken });
      return res.redirect(
        HttpStatus.FOUND,
        `${frontend}/login/?ms_ok=1#ms_token=${encodeURIComponent(accessToken)}`,
      );
    } catch (err: any) {
      const message =
        typeof err?.message === 'string' && err.message.length < 180
          ? err.message
          : 'Microsoft sign-in failed. Try again.';
      return fail(message);
    }
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Login with email and password',
    description: howWhy({
      why: 'Password path (admin / no Microsoft). Company staff should prefer Microsoft SSO.',
      how: 'POST `{ email, password }` → `access_token` (Swagger **Authorize**), or 2FA challenge, or workspace choice.',
      when: 'Login → Use password instead.',
      extras:
        '**2FA:** `{ requires2fa, challengeToken }` → `POST /auth/verify-2fa`.\n**Dual-store:** `{ requiresWorkspaceChoice, workspaceToken, workspaces[] }` (role per store) → `POST /auth/select-workspace`.\n**Blocked:** Microsoft-linked accounts and Demo Access personas must not use this path.\nPrefer `GET /auth/demo-accounts` + `POST /auth/demo-login` for training.',
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
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body.email, body.password);
    maybeAttachAccessCookie(res, result);
    return result;
  }

  @Post('verify-demo-access')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Verify demo-guide access code (server-side)',
    description: howWhy({
      why: 'Unlock /demo-guide without baking the code into the frontend bundle.',
      how: 'POST `{ accessCode }` → `{ ok: true }` when it matches DEMO_ACCESS_CODE.',
    }),
  })
  @ApiBody({ type: VerifyDemoAccessDto })
  @ApiSopResponses({
    successStatus: 201,
    successData: { ok: true },
    auth: false,
  })
  async verifyDemoAccess(@Body() body: VerifyDemoAccessDto) {
    assertDemoAccessCode(body?.accessCode);
    return { ok: true };
  }

  @Get('demo-guide-pack')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Demo guide credential pack (server-side)',
    description: howWhy({
      why: 'Show test passwords only after DEMO_ACCESS_CODE — never ship them in the frontend bundle.',
      how: 'GET with `X-Demo-Access-Code` → `{ primaryAccounts, demoStaff }` (includes passwords).',
    }),
  })
  @ApiHeader({
    name: 'X-Demo-Access-Code',
    required: false,
    description: 'Required when DEMO_ACCESS_CODE is configured on the API',
  })
  @ApiSopResponses({
    successData: {
      primaryAccounts: [],
      demoStaff: [],
    },
    auth: false,
  })
  async demoGuidePack(@Headers('x-demo-access-code') headerCode?: string) {
    assertDemoAccessCode(readDemoAccessCode({ header: headerCode }));
    return this.authService.getDemoGuidePack();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Current session user',
    description: howWhy({
      why: 'Restore the signed-in user from httpOnly cookie or Bearer token after Microsoft redirect.',
      how: 'GET with cookie/Bearer → `{ user }` (same shape as login).',
    }),
  })
  @ApiSopResponses({ successData: { user: LOGIN_DATA.user } })
  async me(@Request() req: any) {
    return {
      user: {
        id: req.user.userId,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        mustChangePassword: Boolean(req.user.mustChangePassword),
        mustSetupTotp: Boolean(req.user.mustSetupTotp),
        totpEnabled: Boolean(req.user.totpEnabled),
        assignedProjects: Array.isArray(req.user.assignedProjects)
          ? req.user.assignedProjects
          : [],
        isDemo: Boolean(req.user.isDemo),
        store: req.user.store === 'demo' ? 'demo' : 'live',
        microsoftLinked: Boolean(req.user.microsoftLinked),
      },
    };
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Clear session cookie',
    description: howWhy({
      why: 'Sign out clears the httpOnly access cookie.',
      how: 'POST → `{ ok: true }` and clears `ace_af_token`.',
    }),
  })
  @ApiSopResponses({ successStatus: 201, successData: { ok: true }, auth: false })
  logout(@Res({ passthrough: true }) res: Response) {
    clearAccessCookie(res);
    return { ok: true };
  }

  @Get('demo-accounts')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'List Demo Access personas (dynamic)',
    description: howWhy({
      why: 'Login Demo Access picker shows every active isDemo user in the demo database.',
      how: 'GET with `X-Demo-Access-Code` (when DEMO_ACCESS_CODE is set) → `[{ id, name, email, role, assignedProjects }]`.',
    }),
  })
  @ApiHeader({
    name: 'X-Demo-Access-Code',
    required: false,
    description: 'Required when DEMO_ACCESS_CODE is configured on the API',
  })
  @ApiSopResponses({
    successData: [
      {
        id: '66f1a2b3c4d5e6f7a89b0c1d',
        name: 'Requester GAC',
        email: 'requester.gac@acefinance.com',
        role: 'REQUESTER',
        assignedProjects: ['Google Art and culture (GAC)'],
      },
    ],
    auth: false,
  })
  async demoAccounts(@Headers('x-demo-access-code') headerCode?: string) {
    assertDemoAccessCode(readDemoAccessCode({ header: headerCode }));
    return this.authService.listDemoAccounts();
  }

  @Post('demo-login')
  @ApiOperation({
    summary: 'Demo Access login (demo database only)',
    description: howWhy({
      why: 'Client demos / training without touching live company data.',
      how: 'POST `{ email, password }` + demo access code (header or body) for an active isDemo user → JWT with `store: "demo"`.',
      when: 'Login page → Demo Access.',
    }),
  })
  @ApiHeader({
    name: 'X-Demo-Access-Code',
    required: false,
    description: 'Required when DEMO_ACCESS_CODE is configured on the API',
  })
  @ApiBody({ type: DemoLoginDto })
  @ApiSopResponses({
    successStatus: 201,
    successData: LOGIN_DATA,
    successDescription: 'Signed into the demo store (isDemo persona).',
    auth: 'Not a demo persona / inactive / bad access code / bad password',
  })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async demoLogin(
    @Body() body: DemoLoginDto,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-demo-access-code') headerCode?: string,
  ) {
    assertDemoAccessCode(
      readDemoAccessCode({
        header: headerCode,
        bodyCode: body.accessCode,
      }),
    );
    const result = await this.authService.demoLogin(body.email, body.password);
    maybeAttachAccessCookie(res, result);
    return result;
  }

  @Post('select-workspace')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Choose Live or Demo workspace (dual-store accounts)',
    description: howWhy({
      why: 'Same email can exist in Live and Demo with different roles — user picks which workspace to open.',
      how: 'After login / Microsoft returns `requiresWorkspaceChoice` / `ms_workspace`, POST `{ workspaceToken, store: "live"|"demo" }` → access token. Each option includes the role in that store.',
      when: 'Email exists in both databases (or Live ADMIN opening Demo for the first time).',
    }),
  })
  @ApiBody({ type: SelectWorkspaceDto })
  @ApiSopResponses({
    successStatus: 201,
    successData: LOGIN_DATA,
    successDescription: 'Signed into the chosen store (live or demo).',
    auth: 'Invalid or expired workspaceToken',
    badRequest: 'Choose live or demo workspace.',
  })
  async selectWorkspace(
    @Body() body: SelectWorkspaceDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.selectWorkspace(
      body.workspaceToken,
      body.store,
    );
    maybeAttachAccessCookie(res, result);
    return result;
  }

  @Post('verify-2fa')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
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
  async verify2fa(
    @Body() body: Verify2faDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyLogin2fa(body);
    maybeAttachAccessCookie(res, result);
    return result;
  }

  @Post('resend-otp')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
  async totpEnable(
    @Request() req: any,
    @Body() body: TotpCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.enableTotp(
      req.user.userId,
      req.user.role,
      body.code,
    );
    maybeAttachAccessCookie(res, result);
    return result;
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
  async changePassword(
    @Request() req: any,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(
      req.user.userId,
      body.currentPassword,
      body.newPassword,
      body.confirmPassword,
    );
    maybeAttachAccessCookie(res, result);
    return result;
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
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

  // Bootstrap seed — requires X-Seed-Secret matching SEED_SECRET
  @Post('seed')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Seed admin, categories, countries and demo users',
    description: howWhy({
      why: 'Bootstrap an empty database.',
      how: 'POST with header `X-Seed-Secret: <SEED_SECRET>`. Safe to repeat — existing records are skipped. Disabled when SEED_SECRET is unset.',
    }),
  })
  @ApiHeader({
    name: 'X-Seed-Secret',
    required: true,
    description: 'Must match API env SEED_SECRET',
  })
  @ApiSopResponses({
    successStatus: 201,
    successData: {
      created: false,
      message: 'Users already exist. Seed skipped.',
    },
    auth: false,
  })
  async seed(@Headers('x-seed-secret') seedSecret?: string) {
    assertSeedSecret(seedSecret);
    return this.authService.seed();
  }
}
