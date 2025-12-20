import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CrmOpportunity } from './crm-opportunity.entity';
import { Customer } from '../../customers/entities/customer.entity';

@Entity('crm_tasks')
export class CrmTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 220 })
  title: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  opportunityId: string | null;

  @ManyToOne(() => CrmOpportunity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'opportunityId' })
  opportunity: CrmOpportunity | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  accountId: string | null;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'accountId' })
  account: Customer | null;

  @Column({ type: 'varchar', length: 48, nullable: true })
  dueAt: string | null;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  source: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  sourceRuleId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  assigneeUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigneeUserId' })
  assigneeUser: User | null;

  @Index()
  @Column({ type: 'uuid' })
  createdByUserId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: User | null;

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updatedByUserId' })
  updatedByUser: User | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
