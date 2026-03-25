import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class AuthService {
  constructor(
    private usersRepository: UsersRepository,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = this.usersRepository.findByUsername(username);
    if (!user) throw new UnauthorizedException('Invalid username or password');

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw new UnauthorizedException('Invalid username or password');

    const payload = { sub: user.id, username: user.username, role: user.role, name: user.name };
    return {
      token: this.jwtService.sign(payload),
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    };
  }
}
