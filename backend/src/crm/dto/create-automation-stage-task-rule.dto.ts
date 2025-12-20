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

export class CreateAutomationStageTaskRuleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsUUID()
  fromStageId?: string | null;

  @IsUUID()
  toStageId: string;

  @IsString()
  @MaxLength(220)
  titleTemplate: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  dueInDays?: number;

  @IsOptional()
  @IsIn(['owner', 'mover', 'specific'])
  assigneeTarget?: 'owner' | 'mover' | 'specific';

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string | null;
}
