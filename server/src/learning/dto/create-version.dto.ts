import { IsString, MaxLength, MinLength } from 'class-validator';
export class CreateVersionDto {
  @IsString() @MinLength(1) @MaxLength(100000) content!: string;
}
