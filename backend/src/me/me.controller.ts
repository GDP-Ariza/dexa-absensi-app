import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersRepository } from '../users/users.repository';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private usersRepository: UsersRepository) {}

  @Get()
  getProfile(@Request() req) {
    const user = this.usersRepository.findById(req.user.id);
    if (!user) return req.user;
    const { password_hash, ...profile } = user;
    return profile;
  }
}
