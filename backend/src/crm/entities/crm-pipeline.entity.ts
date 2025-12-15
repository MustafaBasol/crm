import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { CrmStage } from './crm-stage.entity';

@Entity('crm_pipelines')
@Unique(['tenantId', 'name'])
export class CrmPipeline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'boolean', default: true })
  isDefault: boolean;

  @OneToMany(() => CrmStage, (stage) => stage.pipeline)
  stages: CrmStage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
