import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CHALLENGE_TOKEN_EXAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NmYxYTJiM2M0ZDVlNmY3YTg5YjBjMWQiLCJwdXJwb3NlIjoiMmZhIn0.signature';

export class LoginDto {
  @ApiProperty({ example: 'finance@aceolution.com' })
  email: string;

  @ApiProperty({ example: 'Admin@1234' })
  password: string;
}

export class DemoLoginDto {
  @ApiProperty({ example: 'requester.gac@acefinance.com' })
  email: string;

  @ApiProperty({
    example: 'Requester@1234',
    description: 'Persona password (required).',
  })
  password: string;

  @ApiPropertyOptional({
    example: 'your-demo-access-code',
    description:
      'Required when API has DEMO_ACCESS_CODE set (same value as demo-guide unlock). Prefer header X-Demo-Access-Code.',
  })
  accessCode?: string;
}

export class VerifyDemoAccessDto {
  @ApiProperty({
    example: 'your-demo-access-code',
    description: 'Same code as DEMO_ACCESS_CODE / demo-guide unlock password',
  })
  accessCode: string;
}

export class Verify2faDto {
  @ApiProperty({
    example: CHALLENGE_TOKEN_EXAMPLE,
    description: 'challengeToken returned by POST /auth/login',
  })
  challengeToken: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit email OTP or authenticator code',
  })
  code: string;

  @ApiPropertyOptional({
    enum: ['email', 'totp'],
    default: 'email',
    example: 'email',
  })
  method?: 'email' | 'totp';
}

export class ResendOtpDto {
  @ApiProperty({
    example: CHALLENGE_TOKEN_EXAMPLE,
    description: 'challengeToken returned by POST /auth/login',
  })
  challengeToken: string;
}

export class SelectWorkspaceDto {
  @ApiProperty({
    example: CHALLENGE_TOKEN_EXAMPLE,
    description: 'workspaceToken returned when admin must choose Live vs Demo',
  })
  workspaceToken: string;

  @ApiProperty({
    enum: ['live', 'demo'],
    example: 'live',
    description: 'live = company data; demo = training sandbox',
  })
  store: 'live' | 'demo';
}

export class TotpCodeDto {
  @ApiProperty({ example: '123456', description: '6-digit authenticator code' })
  code: string;
}

export class PasswordConfirmDto {
  @ApiProperty({
    example: 'Admin@1234',
    description: 'Current account password',
  })
  password: string;
}

export class PasswordWithCodeDto {
  @ApiProperty({
    example: 'Admin@1234',
    description: 'Current account password',
  })
  password: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'Email verification code (if required)',
  })
  code?: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    example: 'TempPass@123',
    description: 'Current (or temporary) password',
  })
  currentPassword: string;

  @ApiProperty({
    example: 'NewPassword@123',
    description: 'Min 8 characters, at least one letter and one number',
  })
  newPassword: string;

  @ApiPropertyOptional({
    example: 'NewPassword@123',
    description: 'Must match newPassword',
  })
  confirmPassword?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'finance@aceolution.com' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: '3f9c2a7e1b5d4c8a9e0f6b2d7c1a4e8f5b3a9c7e2d1f4a6b8c0e9d7f5a3b1c2e',
    description: 'Token from the password reset email link (?token=…)',
  })
  token: string;

  @ApiProperty({
    example: 'NewPassword@123',
    description: 'Min 8 characters, at least one letter and one number',
  })
  newPassword: string;

  @ApiProperty({
    example: 'NewPassword@123',
    description: 'Must match newPassword',
  })
  confirmPassword: string;
}
