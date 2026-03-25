import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [AuthModule, UsersModule, AttendanceModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
