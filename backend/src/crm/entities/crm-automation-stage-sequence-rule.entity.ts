import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { CrmAutomationAssigneeTarget } from './crm-automation-rule.entity';

export type CrmAutomationStageSequenceItem = {
  titleTemplate: string;
  dueInDays: number;
};

@Entity('crm_automation_stage_sequence_rules')
export class CrmAutomationStageSequenceRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'uuid', nullable: true })
  fromStageId: string | null;

  @Index()
  @Column({ type: 'uuid' })
  toStageId: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  items: CrmAutomationStageSequenceItem[];

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
