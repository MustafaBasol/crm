import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MaxLength(220)
  title: string;

  @IsUUID()
  opportunityId: string;

  // UI currently treats this as a free-form string (e.g. ISO date or localized date)
  @ApiPropertyOptional({ example: '2025-12-15' })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  dueAt?: string | null;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string | null;
}
