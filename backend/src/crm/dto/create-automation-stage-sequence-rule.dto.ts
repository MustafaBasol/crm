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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class StageSequenceItemDto {
  @IsString()
  @MaxLength(220)
  titleTemplate: string;

  @IsInt()
  @Min(0)
  dueInDays: number;
}

export class CreateAutomationStageSequenceRuleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsUUID()
  fromStageId?: string | null;

  @IsUUID()
  toStageId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => StageSequenceItemDto)
  items: StageSequenceItemDto[];

  @IsOptional()
  @IsIn(['owner', 'mover', 'specific'])
  assigneeTarget?: 'owner' | 'mover' | 'specific';

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string | null;
}
