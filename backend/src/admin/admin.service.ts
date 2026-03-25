import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { AttendanceRepository } from '../attendance/attendance.repository';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';

@Injectable()
export class AdminService {
  constructor(
    private usersRepository: UsersRepository,
    private attendanceRepository: AttendanceRepository,
  ) {}

  listEmployees(page = 1, limit = 20) {
    const users = this.usersRepository.findAll();
    const total = users.length;
    const data = users
      .slice((page - 1) * limit, page * limit)
      .map(({ password_hash, ...u }) => u);
    return { page, limit, total, data };
  }

  getEmployee(id: string) {
    const user = this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('Employee not found');
    const { password_hash, ...profile } = user;
    return profile;
  }

  updateEmployee(id: string, dto: UpdateEmployeeDto) {
    const user = this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('Employee not found');
    const updated = this.usersRepository.update(id, dto);
    const { password_hash, ...profile } = updated!;
    return profile;
  }

  getAllAttendance(filter: AttendanceFilterDto) {
    const now = new Date();
    const month = filter.month ?? now.getMonth() + 1;
    const year = filter.year ?? now.getFullYear();
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const userMap = new Map(this.usersRepository.findAll().map((u) => [u.id, u]));

    let records = this.attendanceRepository.findAll().filter((r) => {
      const [y, m] = r.date.split('-').map(Number);
      const matchMonth = y === year && m === month;
      const matchEmployee = !filter.employee_id || r.user_id === filter.employee_id;
      return matchMonth && matchEmployee;
    });

    const total = records.length;
    records = records.slice((page - 1) * limit, page * limit);

    const data = records.map((r) => {
      const user = userMap.get(r.user_id);
      return {
        employee: user
          ? { id: user.id, name: user.name, department: user.department }
          : { id: r.user_id, name: 'Unknown', department: '' },
        date: r.date,
        check_in: r.check_in_time
          ? {
              time: r.check_in_time,
              latitude: parseFloat(r.check_in_lat),
              longitude: parseFloat(r.check_in_lng),
              location_name: r.check_in_location,
            }
          : null,
        check_out: r.check_out_time
          ? {
              time: r.check_out_time,
              latitude: parseFloat(r.check_out_lat),
              longitude: parseFloat(r.check_out_lng),
              location_name: r.check_out_location,
            }
          : null,
        status: r.status,
        total_hours: r.total_hours ? parseFloat(r.total_hours) : null,
      };
    });

    return { page, limit, total, data };
  }
}
