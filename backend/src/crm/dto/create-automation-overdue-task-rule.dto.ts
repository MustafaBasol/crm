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

export class CreateAutomationOverdueTaskRuleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsInt()
  @Min(0)
  overdueDays: number;

  @IsString()
  @MaxLength(220)
  titleTemplate: string;

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
