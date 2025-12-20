import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CrmAutomationAssigneeTarget = 'owner' | 'mover' | 'specific';

@Entity('crm_automation_stage_task_rules')
export class CrmAutomationStageTaskRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  fromStageId: string | null;

  @Index()
  @Column({ type: 'uuid' })
  toStageId: string;

  @Column({ type: 'varchar', length: 220 })
  titleTemplate: string;

  // Due date offset from trigger time. Stored as days for simplicity.
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
