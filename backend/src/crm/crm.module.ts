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
import { CrmOpportunityStageHistory } from './entities/crm-opportunity-stage-history.entity';
import { CrmAutomationStageTaskRule } from './entities/crm-automation-rule.entity';
import { CrmAutomationStaleDealRule } from './entities/crm-automation-stale-deal-rule.entity';
import { CrmAutomationWonChecklistRule } from './entities/crm-automation-won-checklist-rule.entity';
import { Customer } from '../customers/entities/customer.entity';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { Quote } from '../quotes/entities/quote.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { AuditModule } from '../audit/audit.module';

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
      OrganizationMember,
      Quote,
      Sale,
      Invoice,
      CrmOpportunityStageHistory,
      CrmAutomationStageTaskRule,
      CrmAutomationStaleDealRule,
      CrmAutomationWonChecklistRule,
    ]),
    AuditModule,
  ],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
