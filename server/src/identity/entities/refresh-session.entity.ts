import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { UserAccount } from './user-account.entity';

@Entity({ name: 'RefreshSessions' })
@Index('UQ_RefreshSessions_token_hash', ['tokenHash'], { unique: true })
export class RefreshSession {
  @PrimaryColumn({ type: 'char', length: 36 }) id!: string;
  @Column({ name: 'user_id', type: 'char', length: 36 }) userId!: string;
  @ManyToOne(() => UserAccount, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' }) user!: UserAccount;
  @Column({ name: 'token_hash', type: 'char', length: 64 }) tokenHash!: string;
  @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) expiresAt!: Date;
  @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true }) revokedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt!: Date;
}
