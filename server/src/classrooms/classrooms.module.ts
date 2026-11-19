import { Module } from '@nestjs/common';
import { AuthModule } from '../identity/auth.module';
import { ClassroomsController } from './classrooms.controller';
import { ClassroomsService } from './classrooms.service';

@Module({ imports: [AuthModule], controllers: [ClassroomsController], providers: [ClassroomsService] })
export class ClassroomsModule {}
