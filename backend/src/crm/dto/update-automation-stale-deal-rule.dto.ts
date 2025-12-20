import { PartialType } from '@nestjs/swagger';
import { CreateAutomationStaleDealRuleDto } from './create-automation-stale-deal-rule.dto';

export class UpdateAutomationStaleDealRuleDto extends PartialType(
  CreateAutomationStaleDealRuleDto,
) {}
