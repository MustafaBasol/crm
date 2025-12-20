import { PartialType } from '@nestjs/swagger';
import { CreateAutomationStageTaskRuleDto } from './create-automation-stage-task-rule.dto';

export class UpdateAutomationStageTaskRuleDto extends PartialType(
  CreateAutomationStageTaskRuleDto,
) {}
