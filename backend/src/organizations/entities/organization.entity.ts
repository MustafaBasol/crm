import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrganizationMember } from './organization-member.entity';
import { Invite } from './invite.entity';
import { Plan } from '../../common/enums/organization.enum';

const __sqliteFriendlyEnv =
  process.env.DB_SQLITE === 'true' ||
  process.env.DATABASE_TYPE === 'sqlite' ||
  process.env.NODE_ENV === 'test' ||
  typeof process.env.JEST_WORKER_ID !== 'undefined';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: __sqliteFriendlyEnv ? 'simple-enum' : 'enum',
    enum: Plan,
    default: Plan.STARTER,
  })
  plan: Plan;

  @OneToMany(() => OrganizationMember, (member) => member.organization, {
    cascade: true,
  })
  members: OrganizationMember[];

  @OneToMany(() => Invite, (invite) => invite.organization, {
    cascade: true,
  })
  invites: Invite[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
