import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateAutomationOverdueTaskRuleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  overdueDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  titleTemplate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  dueInDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cooldownDays?: number;

  @IsOptional()
  @IsIn(['owner', 'mover', 'specific'])
  assigneeTarget?: 'owner' | 'mover' | 'specific';

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string | null;
}
