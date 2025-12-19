import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { AtMostOneOf } from '../../common/validators/at-most-one-of.validator';

export class UpdateActivityDto {
  @AtMostOneOf(['opportunityId', 'accountId', 'contactId'], {
    message: 'Provide only one of opportunityId, accountId, contactId',
  })
  relationGuard?: unknown;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsUUID()
  opportunityId?: string | null;

  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @IsOptional()
  @IsUUID()
  contactId?: string | null;

  @IsOptional()
  @IsString()
  dueAt?: string | null;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
