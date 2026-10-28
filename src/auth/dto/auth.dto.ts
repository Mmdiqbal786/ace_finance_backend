import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const CHALLENGE_TOKEN_EXAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NmYxYTJiM2M0ZDVlNmY3YTg5YjBjMWQiLCJwdXJwb3NlIjoiMmZhIn0.signature';

export class LoginDto {
  @ApiProperty({ example: 'finance@aceolution.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Admin@1234' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  password: string;
}

export class DemoLoginDto {
  @ApiProperty({ example: 'requester.gac@acefinance.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'Requester@1234',
    description: 'Persona password (required).',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  password: string;

  @ApiPropertyOptional({
    example: 'your-demo-access-code',
    description:
      'Required when API has DEMO_ACCESS_CODE set (same value as demo-guide unlock). Prefer header X-Demo-Access-Code.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  accessCode?: string;
}

export class VerifyDemoAccessDto {
  @ApiProperty({
    example: 'your-demo-access-code',
    description: 'Same code as DEMO_ACCESS_CODE / demo-guide unlock password',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  accessCode: string;
}

export class Verify2faDto {
  @ApiProperty({
    example: CHALLENGE_TOKEN_EXAMPLE,
    description: 'challengeToken returned by POST /auth/login',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  challengeToken: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit email OTP or authenticator code',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(12)
  code: string;

  @ApiPropertyOptional({
    enum: ['email', 'totp'],
    default: 'email',
    example: 'email',
  })
  @IsOptional()
  @IsIn(['email', 'totp'])
  method?: 'email' | 'totp';
}

export class ResendOtpDto {
  @ApiProperty({
    example: CHALLENGE_TOKEN_EXAMPLE,
    description: 'challengeToken returned by POST /auth/login',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  challengeToken: string;
}

export class SelectWorkspaceDto {
  @ApiProperty({
    example: CHALLENGE_TOKEN_EXAMPLE,
    description: 'workspaceToken returned when admin must choose Live vs Demo',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  workspaceToken: string;

  @ApiProperty({
    enum: ['live', 'demo'],
    example: 'live',
    description: 'live = company data; demo = training sandbox',
  })
  @IsIn(['live', 'demo'])
  store: 'live' | 'demo';
}

export class TotpCodeDto {
  @ApiProperty({ example: '123456', description: '6-digit authenticator code' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(12)
  code: string;
}

export class PasswordConfirmDto {
  @ApiProperty({
    example: 'Admin@1234',
    description: 'Current account password',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}

export class PasswordWithCodeDto {
  @ApiProperty({
    example: 'Admin@1234',
    description: 'Current account password',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'Email verification code (if required)',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(12)
  code?: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    example: 'TempPass@123',
    description: 'Current (or temporary) password',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentPassword: string;

  @ApiProperty({
    example: 'NewPassword@123',
    description: 'Min 8 characters, at least one letter and one number',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(200)
  newPassword: string;

  @ApiPropertyOptional({
    example: 'NewPassword@123',
    description: 'Must match newPassword',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  confirmPassword?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'finance@aceolution.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'reset-token-from-email' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token: string;

  @ApiProperty({ example: 'NewStrongPass@1234' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(200)
  newPassword: string;

  @ApiProperty({ example: 'NewStrongPass@1234' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(200)
  confirmPassword: string;
}
