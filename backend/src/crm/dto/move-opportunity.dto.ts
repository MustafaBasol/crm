import { IsUUID } from 'class-validator';

export class MoveOpportunityDto {
  @IsUUID()
  stageId: string;
}
