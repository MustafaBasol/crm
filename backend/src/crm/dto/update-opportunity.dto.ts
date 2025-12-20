import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class UpdateOpportunityDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

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
  expectedCloseDate?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  probability?: number | null;
}
