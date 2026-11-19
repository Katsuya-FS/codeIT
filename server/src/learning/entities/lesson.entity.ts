import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { CourseModule } from './course-module.entity';
import { LessonVersion } from './lesson-version.entity';

@Entity({ name: 'Lessons' })
export class Lesson {
  @PrimaryColumn({ type: 'char', length: 36 }) id!: string;
  @Column({ name: 'module_id', type: 'char', length: 36 }) moduleId!: string;
  @ManyToOne(() => CourseModule, (module) => module.lessons, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'module_id' }) module!: CourseModule;
  @Column({ type: 'varchar', length: 180 }) title!: string;
  @Column({ type: 'int' }) sequence!: number;
  @Column({ type: 'varchar', length: 16, default: 'draft' }) status!: 'draft' | 'published';
  @OneToMany(() => LessonVersion, (version) => version.lesson) versions!: LessonVersion[];
}
