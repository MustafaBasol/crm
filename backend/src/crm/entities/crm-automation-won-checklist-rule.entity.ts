import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { CrmAutomationAssigneeTarget } from './crm-automation-rule.entity';

@Entity('crm_automation_won_checklist_rules')
export class CrmAutomationWonChecklistRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  // A list of task title templates to create when an opportunity is marked WON.
  // Supported variables: {{opportunityName}}, {{toStageName}}
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  titleTemplates: string[];

  // Due date offset (days) from trigger time.
  @Column({ type: 'int', default: 0 })
  dueInDays: number;

  @Column({ type: 'varchar', length: 16, default: 'owner' })
  assigneeTarget: CrmAutomationAssigneeTarget;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  assigneeUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
