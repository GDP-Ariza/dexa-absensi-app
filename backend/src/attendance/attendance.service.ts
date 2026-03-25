import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AttendanceRepository, AttendanceRecord } from './attendance.repository';
import { LocationDto } from './dto/location.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';

@Injectable()
export class AttendanceService {
  constructor(private attendanceRepository: AttendanceRepository) {}

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  private countWeekdays(year: number, month: number): number {
    let count = 0;
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
      const day = date.getDay();
      if (day !== 0 && day !== 6) count++;
      date.setDate(date.getDate() + 1);
    }
    return count;
  }

  private formatRecord(record: AttendanceRecord) {
    return {
      id: record.id,
      date: record.date,
      check_in: record.check_in_time
        ? {
            time: record.check_in_time,
            latitude: parseFloat(record.check_in_lat),
            longitude: parseFloat(record.check_in_lng),
            location_name: record.check_in_location,
          }
        : null,
      check_out: record.check_out_time
        ? {
            time: record.check_out_time,
            latitude: parseFloat(record.check_out_lat),
            longitude: parseFloat(record.check_out_lng),
            location_name: record.check_out_location,
          }
        : null,
      status: record.status,
      total_hours: record.total_hours ? parseFloat(record.total_hours) : null,
    };
  }

  async checkIn(userId: string, dto: LocationDto) {
    const today = this.getToday();
    const existing = this.attendanceRepository.findByUserAndDate(userId, today);
    if (existing) throw new ConflictException('Already checked in today');

    const record = this.attendanceRepository.create({
      id: uuidv4(),
      user_id: userId,
      date: today,
      check_in_time: new Date().toISOString(),
      check_in_lat: String(dto.latitude),
      check_in_lng: String(dto.longitude),
      check_in_location: dto.location_name || '',
      check_out_time: '',
      check_out_lat: '',
      check_out_lng: '',
      check_out_location: '',
      status: 'checked_in',
      total_hours: '',
    });

    return this.formatRecord(record);
  }

  async checkOut(userId: string, dto: LocationDto) {
    const today = this.getToday();
    const record = this.attendanceRepository.findByUserAndDate(userId, today);
    if (!record || record.status !== 'checked_in') {
      throw new BadRequestException('No active check-in found for today');
    }

    const checkInTime = new Date(record.check_in_time);
    const checkOutTime = new Date();
    const totalHours =
      Math.round(((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)) * 100) / 100;

    const updated = this.attendanceRepository.update(record.id, {
      check_out_time: checkOutTime.toISOString(),
      check_out_lat: String(dto.latitude),
      check_out_lng: String(dto.longitude),
      check_out_location: dto.location_name || '',
      status: 'completed',
      total_hours: String(totalHours),
    });

    return this.formatRecord(updated!);
  }

  getSummary(userId: string, query: AttendanceQueryDto) {
    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();

    const records = this.attendanceRepository.findByUser(userId).filter((r) => {
      const [y, m] = r.date.split('-').map(Number);
      return y === year && m === month;
    });

    return {
      month,
      year,
      total_working_days: this.countWeekdays(year, month),
      present: records.length,
      absent: Math.max(0, this.countWeekdays(year, month) - records.length),
      records: records.map((r) => this.formatRecord(r)),
    };
  }
}
