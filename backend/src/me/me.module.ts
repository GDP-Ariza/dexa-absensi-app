import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [MeController],
})
export class MeModule {}
