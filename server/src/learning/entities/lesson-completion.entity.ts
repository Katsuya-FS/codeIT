import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique, Column } from 'typeorm';
import { StudentProfile } from '../../identity/entities/student-profile.entity';
import { LessonVersion } from './lesson-version.entity';

@Entity({ name: 'LessonCompletions' })
@Unique('UQ_LessonCompletions_student_version', ['studentUserId', 'lessonVersionId'])
export class LessonCompletion {
  @PrimaryColumn({ type: 'char', length: 36 }) id!: string;
  @Column({ name: 'student_user_id', type: 'char', length: 36 }) studentUserId!: string;
  @ManyToOne(() => StudentProfile, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_user_id', referencedColumnName: 'userId' }) student!: StudentProfile;
  @Column({ name: 'lesson_version_id', type: 'char', length: 36 }) lessonVersionId!: string;
  @ManyToOne(() => LessonVersion, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lesson_version_id' }) lessonVersion!: LessonVersion;
  @CreateDateColumn({ name: 'completed_at', type: 'datetime', precision: 3 }) completedAt!: Date;
}
