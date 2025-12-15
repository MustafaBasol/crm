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

@Entity('crm_leads')
export class CrmLead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 220 })
  name: string;

  @Column({ type: 'varchar', length: 220, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 220, nullable: true })
  company: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  status: string | null;

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
