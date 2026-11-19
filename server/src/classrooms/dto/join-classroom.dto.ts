import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class JoinClassroomDto {
  @IsString() @MinLength(8) @MaxLength(24) @Matches(/^[A-Za-z0-9_-]+$/)
  classCode!: string;
}
