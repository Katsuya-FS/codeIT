import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Lesson } from './lesson.entity';

@Entity({ name: 'CourseModules' })
export class CourseModule {
  @PrimaryColumn({ type: 'char', length: 36 }) id!: string;
  @Column({ type: 'varchar', length: 160 }) title!: string;
  @Column({ type: 'int' }) sequence!: number;
  @Column({ type: 'varchar', length: 16, default: 'draft' }) status!: 'draft' | 'published';
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt!: Date;
  @OneToMany(() => Lesson, (lesson) => lesson.module) lessons!: Lesson[];
}
