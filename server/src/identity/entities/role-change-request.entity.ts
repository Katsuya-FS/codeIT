import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { UserAccount } from './user-account.entity';

@Entity({ name: 'RoleChangeRequests' })
export class RoleChangeRequest {
  @PrimaryColumn({ type: 'char', length: 36 }) id!: string;
  @Column({ name: 'student_user_id', type: 'char', length: 36 }) studentUserId!: string;
  @ManyToOne(() => UserAccount, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_user_id' }) student!: UserAccount;
  @Column({ name: 'requested_role', type: 'varchar', length: 32, default: 'Teacher' }) requestedRole!: string;
  @Column({ type: 'varchar', length: 16, default: 'pending' }) status!: 'pending' | 'approved' | 'rejected';
  @Column({ name: 'reviewing_admin_user_id', type: 'char', length: 36, nullable: true }) reviewingAdminUserId!: string | null;
  @ManyToOne(() => UserAccount, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reviewing_admin_user_id' }) reviewingAdmin!: UserAccount | null;
  @CreateDateColumn({ name: 'requested_at', type: 'datetime', precision: 3 }) requestedAt!: Date;
  @Column({ name: 'decided_at', type: 'datetime', precision: 3, nullable: true }) decidedAt!: Date | null;
}
