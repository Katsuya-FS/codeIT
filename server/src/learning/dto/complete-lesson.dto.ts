import { IsUUID } from 'class-validator';
export class CompleteLessonDto { @IsUUID() lessonVersionId!: string; }
