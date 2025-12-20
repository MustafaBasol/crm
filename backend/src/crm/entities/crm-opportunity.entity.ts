import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { CrmStage } from './crm-stage.entity';
import { CrmPipeline } from './crm-pipeline.entity';

export enum CrmOpportunityStatus {
  OPEN = 'open',
  WON = 'won',
  LOST = 'lost',
}

@Entity('crm_opportunities')
export class CrmOpportunity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  // Account = Customer
  @Index()
  @Column({ type: 'uuid', nullable: true })
  accountId: string | null;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'accountId' })
  account: Customer | null;

  @Index()
  @Column({ type: 'uuid' })
  pipelineId: string;

  @ManyToOne(() => CrmPipeline, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pipelineId' })
  pipeline: CrmPipeline;

  @Index()
  @Column({ type: 'uuid' })
  stageId: string;

  @ManyToOne(() => CrmStage, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stageId' })
  stage: CrmStage;

  @Index()
  @Column({ type: 'uuid' })
  ownerUserId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ownerUserId' })
  ownerUser: User;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'TRY' })
  currency: string;

  // 0..1 (nullable). If null, reports may derive a default from stage order.
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  probability: number | null;

  @Column({ type: 'date', nullable: true })
  expectedCloseDate: Date | null;

  @Column({ type: 'varchar', length: 32, default: CrmOpportunityStatus.OPEN })
  status: CrmOpportunityStatus;

  @Column({ type: 'timestamptz', nullable: true })
  wonAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lostAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lostReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
