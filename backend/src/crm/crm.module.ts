import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CrmPipeline } from './entities/crm-pipeline.entity';
import { CrmStage } from './entities/crm-stage.entity';
import { CrmOpportunity } from './entities/crm-opportunity.entity';
import { CrmOpportunityMember } from './entities/crm-opportunity-member.entity';
import { CrmActivity } from './entities/crm-activity.entity';
import { CrmTask } from './entities/crm-task.entity';
import { CrmLead } from './entities/crm-lead.entity';
import { CrmContact } from './entities/crm-contact.entity';
import { Customer } from '../customers/entities/customer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CrmPipeline,
      CrmStage,
      CrmOpportunity,
      CrmOpportunityMember,
      CrmActivity,
      CrmTask,
      CrmLead,
      CrmContact,
      Customer,
    ]),
  ],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
