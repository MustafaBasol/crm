import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type NotificationType = 'info' | 'warning' | 'success' | 'danger';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  tenantId: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 220 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 24, nullable: true })
  type: NotificationType | null;

  @Column({ type: 'varchar', length: 220, nullable: true })
  link: string | null;

  @Index()
  @Column({ type: 'varchar', length: 220, nullable: true })
  relatedId: string | null;

  @Column({ type: 'varchar', length: 220, nullable: true })
  i18nTitleKey: string | null;

  @Column({ type: 'varchar', length: 220, nullable: true })
  i18nDescKey: string | null;

  @Column({ type: 'jsonb', nullable: true })
  i18nParams: Record<string, unknown> | null;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
