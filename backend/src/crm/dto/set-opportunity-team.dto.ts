import { IsArray, IsUUID } from 'class-validator';

export class SetOpportunityTeamDto {
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];
}
