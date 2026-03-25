import { Injectable } from '@nestjs/common';
import { CsvRepository } from '../common/csv/csv.repository';

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string;
  check_in_lat: string;
  check_in_lng: string;
  check_in_location: string;
  check_out_time: string;
  check_out_lat: string;
  check_out_lng: string;
  check_out_location: string;
  status: string;
  total_hours: string;
}

const COLUMNS = [
  'id', 'user_id', 'date',
  'check_in_time', 'check_in_lat', 'check_in_lng', 'check_in_location',
  'check_out_time', 'check_out_lat', 'check_out_lng', 'check_out_location',
  'status', 'total_hours',
];

@Injectable()
export class AttendanceRepository {
  private csv = new CsvRepository<AttendanceRecord>('attendance.csv');

  findAll(): AttendanceRecord[] {
    return this.csv.readAll();
  }

  findByUserAndDate(userId: string, date: string): AttendanceRecord | undefined {
    return this.csv.readAll().find((r) => r.user_id === userId && r.date === date);
  }

  findByUser(userId: string): AttendanceRecord[] {
    return this.csv.readAll().filter((r) => r.user_id === userId);
  }

  create(record: AttendanceRecord): AttendanceRecord {
    const records = this.csv.readAll();
    records.push(record);
    this.csv.writeAll(records, COLUMNS);
    return record;
  }

  update(id: string, data: Partial<AttendanceRecord>): AttendanceRecord | undefined {
    const records = this.csv.readAll();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    records[idx] = { ...records[idx], ...data };
    this.csv.writeAll(records, COLUMNS);
    return records[idx];
  }
}
