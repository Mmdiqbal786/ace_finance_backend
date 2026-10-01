import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ROLES = ['ADMIN', 'APPROVER', 'PROCESSOR', 'REQUESTER'] as const;
type Role = (typeof ROLES)[number];

export class CreateUserDto {
  @ApiProperty({ example: 'Jane Doe' })
  name: string;

  @ApiProperty({ example: 'jane@aceolution.com' })
  email: string;

  @ApiProperty({ enum: ROLES, example: 'REQUESTER' })
  role: Role;

  @ApiPropertyOptional({
    example: 'TempPass@123',
    description:
      'Temporary password (min 8 chars). Omit to auto-generate one; it is emailed to the user.',
  })
  password?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Google Art and culture (GAC)'],
    description:
      'Project names the user can access (required for REQUESTER / APPROVER)',
  })
  assignedProjects?: string[];
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  name?: string;

  @ApiPropertyOptional({ enum: ROLES, example: 'APPROVER' })
  role?: Role;

  @ApiPropertyOptional({
    example: true,
    description: 'false blocks sign-in',
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'TempPass@123',
    description: 'Admin reset — user must change it on next login',
  })
  password?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Google Art and culture (GAC)', 'Google News Lab (GNL)'],
  })
  assignedProjects?: string[];
}

export class UpdateMeDto {
  @ApiProperty({ example: 'Jane Doe', description: 'Min 2 characters' })
  name: string;
}
