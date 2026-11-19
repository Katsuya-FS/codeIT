import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
export class CreateLessonDto {
  @IsString() @MinLength(2) @MaxLength(180) title!: string;
  @IsInt() @Min(1) @Max(10000) sequence!: number;
}
