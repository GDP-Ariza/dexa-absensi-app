import { Injectable } from '@nestjs/common';
import { CsvRepository } from '../common/csv/csv.repository';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  email: string;
  department: string;
  position: string;
  role: string;
  created_at: string;
}

const COLUMNS = ['id', 'username', 'password_hash', 'name', 'email', 'department', 'position', 'role', 'created_at'];

@Injectable()
export class UsersRepository {
  private csv = new CsvRepository<User>('users.csv');

  findAll(): User[] {
    return this.csv.readAll();
  }

  findById(id: string): User | undefined {
    return this.csv.readAll().find((u) => u.id === id);
  }

  findByUsername(username: string): User | undefined {
    return this.csv.readAll().find((u) => u.username === username);
  }

  update(id: string, data: Partial<User>): User | undefined {
    const users = this.csv.readAll();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    users[idx] = { ...users[idx], ...data };
    this.csv.writeAll(users, COLUMNS);
    return users[idx];
  }
}
