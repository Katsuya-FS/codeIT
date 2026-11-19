import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
export class CreateModuleDto {
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsInt() @Min(1) @Max(10000) sequence!: number;
}
