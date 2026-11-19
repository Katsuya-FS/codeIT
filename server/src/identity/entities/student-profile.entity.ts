import { Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { UserAccount } from './user-account.entity';

@Entity({ name: 'StudentProfiles' })
export class StudentProfile {
  @PrimaryColumn({ name: 'user_id', type: 'char', length: 36 }) userId!: string;
  @OneToOne(() => UserAccount, (user) => user.studentProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' }) user!: UserAccount;
}
