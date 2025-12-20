import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  Min,
  IsIn,
  IsDateString,
  IsArray,
  Max,
} from 'class-validator';

export class CreateOpportunityDto {
  @IsUUID()
  accountId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['TRY', 'USD', 'EUR', 'GBP'])
  currency?: string;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  probability?: number | null;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  // Takım: owner harici üyeler
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teamUserIds?: string[];
}
