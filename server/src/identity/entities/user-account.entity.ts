import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Role } from './role.entity';
import { StudentProfile } from './student-profile.entity';

@Entity({ name: 'UserAccounts' })
export class UserAccount {
  @PrimaryColumn({ type: 'char', length: 36 }) id!: string;
  @Column({ type: 'varchar', length: 254, unique: true }) email!: string;
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false }) passwordHash!: string;
  @Column({ name: 'display_name', type: 'varchar', length: 80 }) displayName!: string;
  @Column({ type: 'varchar', length: 500, default: '' }) bio!: string;
  @Column({ name: 'role_name', type: 'varchar', length: 32 }) roleName!: string;
  @ManyToOne(() => Role, (role) => role.users, { nullable: false })
  @JoinColumn({ name: 'role_name', referencedColumnName: 'name' }) role!: Role;
  @Column({ type: 'varchar', length: 16, default: 'active' }) status!: 'active' | 'inactive';
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt!: Date;
  @OneToOne(() => StudentProfile, (profile) => profile.user) studentProfile?: StudentProfile;
}
