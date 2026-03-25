import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [AuthModule, MeModule, AttendanceModule, AdminModule],
})
export class AppModule {}
