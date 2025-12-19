import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { Quote } from './entities/quote.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';
import { CrmOpportunity } from '../crm/entities/crm-opportunity.entity';
import { CrmOpportunityMember } from '../crm/entities/crm-opportunity-member.entity';
import { CrmStage } from '../crm/entities/crm-stage.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quote,
      Tenant,
      BankAccount,
      CrmOpportunity,
      CrmOpportunityMember,
      CrmStage,
    ]),
  ],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
