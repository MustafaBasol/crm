import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { CrmPipeline } from './crm-pipeline.entity';

@Entity('crm_stages')
@Unique(['tenantId', 'pipelineId', 'order'])
@Unique(['tenantId', 'pipelineId', 'name'])
export class CrmStage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Index()
  @Column({ type: 'uuid' })
  pipelineId: string;

  @ManyToOne(() => CrmPipeline, (pipeline) => pipeline.stages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pipelineId' })
  pipeline: CrmPipeline;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'int' })
  order: number;

  @Column({ type: 'boolean', default: false })
  isClosedWon: boolean;

  @Column({ type: 'boolean', default: false })
  isClosedLost: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
