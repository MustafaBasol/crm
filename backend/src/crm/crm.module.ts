import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CrmPipeline } from './entities/crm-pipeline.entity';
import { CrmStage } from './entities/crm-stage.entity';
import { CrmOpportunity } from './entities/crm-opportunity.entity';
import { CrmOpportunityMember } from './entities/crm-opportunity-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CrmPipeline,
      CrmStage,
      CrmOpportunity,
      CrmOpportunityMember,
    ]),
  ],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
