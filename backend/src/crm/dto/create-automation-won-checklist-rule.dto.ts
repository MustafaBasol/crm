import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAutomationWonChecklistRuleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(220, { each: true })
  titleTemplates: string[];

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
