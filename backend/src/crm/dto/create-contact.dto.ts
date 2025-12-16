import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateContactDto {
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
  @IsUUID()
  accountId?: string | null;
}
