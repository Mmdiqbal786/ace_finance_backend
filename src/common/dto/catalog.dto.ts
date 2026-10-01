import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'Google News Lab (GNL)' })
  name: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Google News Lab' })
  name?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'false hides it from the request form dropdown',
  })
  isActive?: boolean;
}

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Training',
    description: 'Name stored on expenses (category field)',
  })
  name: string;

  @ApiProperty({ example: 'Training' })
  label: string;

  @ApiPropertyOptional({
    example: '📚',
    description: 'Emoji shown in dropdowns',
  })
  icon?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Training' })
  name?: string;

  @ApiPropertyOptional({ example: 'Training & Courses' })
  label?: string;

  @ApiPropertyOptional({ example: '🎓' })
  icon?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'false hides it from the request form dropdown',
  })
  isActive?: boolean;
}

export class CreateCountryDto {
  @ApiProperty({ example: 'India' })
  name: string;

  @ApiProperty({ example: 'INR' })
  currency: string;
}

export class UpdateCountryDto {
  @ApiPropertyOptional({ example: 'Japan' })
  name?: string;

  @ApiPropertyOptional({ example: 'JPY', description: 'ISO 4217 code' })
  currency?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'false hides it from the request form dropdown',
  })
  isActive?: boolean;
}
