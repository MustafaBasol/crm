import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { CrmAutomationAssigneeTarget } from './crm-automation-rule.entity';

@Entity('crm_automation_stale_deal_rules')
export class CrmAutomationStaleDealRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  // Opportunity becomes stale if updatedAt is older than now - staleDays
  @Column({ type: 'int', default: 30 })
  staleDays: number;

  // Optional stage filter
  @Index()
  @Column({ type: 'uuid', nullable: true })
  stageId: string | null;

  @Column({ type: 'varchar', length: 220 })
  titleTemplate: string;

  // Due date offset (days) from run time.
  @Column({ type: 'int', default: 0 })
  dueInDays: number;

  @Column({ type: 'varchar', length: 16, default: 'owner' })
  assigneeTarget: CrmAutomationAssigneeTarget;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  assigneeUserId: string | null;

  // Prevent spamming: do not create another task for same rule+opportunity within cooldownDays.
  @Column({ type: 'int', default: 7 })
  cooldownDays: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
