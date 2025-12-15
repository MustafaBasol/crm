import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @MaxLength(220)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;
}
