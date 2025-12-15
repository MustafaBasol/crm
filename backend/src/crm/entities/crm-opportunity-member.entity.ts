import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CrmOpportunity } from './crm-opportunity.entity';

@Entity('crm_opportunity_members')
@Unique(['tenantId', 'opportunityId', 'userId'])
export class CrmOpportunityMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Index()
  @Column({ type: 'uuid' })
  opportunityId: string;

  @ManyToOne(() => CrmOpportunity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'opportunityId' })
  opportunity: CrmOpportunity;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
