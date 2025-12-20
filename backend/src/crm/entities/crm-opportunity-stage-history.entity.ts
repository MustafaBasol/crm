import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CrmOpportunity } from './crm-opportunity.entity';
import { CrmStage } from './crm-stage.entity';
import { User } from '../../users/entities/user.entity';

@Entity('crm_opportunity_stage_history')
export class CrmOpportunityStageHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  tenantId: string;

  @Index()
  @Column({ type: 'uuid' })
  opportunityId: string;

  @ManyToOne(() => CrmOpportunity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'opportunityId' })
  opportunity: CrmOpportunity;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  fromStageId: string | null;

  @ManyToOne(() => CrmStage, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'fromStageId' })
  fromStage: CrmStage | null;

  @Index()
  @Column({ type: 'uuid' })
  toStageId: string;

  @ManyToOne(() => CrmStage, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'toStageId' })
  toStage: CrmStage;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  changedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'changedByUserId' })
  changedByUser: User | null;

  @Index()
  @CreateDateColumn()
  changedAt: Date;
}
