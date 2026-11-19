import { CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn, Column } from 'typeorm';
import { UserAccount } from './user-account.entity';

@Entity({ name: 'TeacherProfiles' })
export class TeacherProfile {
  @PrimaryColumn({ name: 'user_id', type: 'char', length: 36 }) userId!: string;
  @OneToOne(() => UserAccount, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'user_id' }) user!: UserAccount;
  @Column({ name: 'approved_by_user_id', type: 'char', length: 36 }) approvedByUserId!: string;
  @ManyToOne(() => UserAccount, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'approved_by_user_id' }) approvedBy!: UserAccount;
  @CreateDateColumn({ name: 'approved_at', type: 'datetime', precision: 3 }) approvedAt!: Date;
}
