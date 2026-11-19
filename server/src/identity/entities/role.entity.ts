import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { UserAccount } from './user-account.entity';

@Entity({ name: 'Roles' })
export class Role {
  @PrimaryColumn({ type: 'varchar', length: 32 }) name!: string;
  @Column({ type: 'varchar', length: 120 }) label!: string;
  @OneToMany(() => UserAccount, (user) => user.role) users!: UserAccount[];
}
