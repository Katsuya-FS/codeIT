import { IsUUID } from 'class-validator';

export class CreateClassroomActivityDto {
  @IsUUID() challengeId!: string;
}
