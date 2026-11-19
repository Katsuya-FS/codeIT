import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { Lesson } from './lesson.entity';

@Entity({ name: 'LessonVersions' })
@Unique('UQ_LessonVersions_lesson_version', ['lessonId', 'versionNumber'])
export class LessonVersion {
  @PrimaryColumn({ type: 'char', length: 36 }) id!: string;
  @Column({ name: 'lesson_id', type: 'char', length: 36 }) lessonId!: string;
  @ManyToOne(() => Lesson, (lesson) => lesson.versions, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lesson_id' }) lesson!: Lesson;
  @Column({ name: 'version_number', type: 'int' }) versionNumber!: number;
  @Column({ type: 'longtext' }) content!: string;
  @Column({ type: 'varchar', length: 16, default: 'draft' }) status!: 'draft' | 'published';
  @Column({ name: 'published_at', type: 'datetime', precision: 3, nullable: true }) publishedAt!: Date | null;
}
