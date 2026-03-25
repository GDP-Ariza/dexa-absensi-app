import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify/sync';

async function seed() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const adminHash = await bcrypt.hash('admin123', 10);
  const employeeHash = await bcrypt.hash('employee123', 10);

  const users = [
    {
      id: 'u001',
      username: 'admin',
      password_hash: adminHash,
      name: 'Admin User',
      email: 'admin@company.com',
      department: 'IT',
      position: 'System Administrator',
      role: 'admin',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'u002',
      username: 'john.doe',
      password_hash: employeeHash,
      name: 'John Doe',
      email: 'john@company.com',
      department: 'Engineering',
      position: 'Software Engineer',
      role: 'employee',
      created_at: '2026-01-15T00:00:00.000Z',
    },
  ];

  fs.writeFileSync(path.join(dataDir, 'users.csv'), stringify(users, { header: true }));

  const attendanceHeaders =
    'id,user_id,date,check_in_time,check_in_lat,check_in_lng,check_in_location,' +
    'check_out_time,check_out_lat,check_out_lng,check_out_location,status,total_hours\n';
  fs.writeFileSync(path.join(dataDir, 'attendance.csv'), attendanceHeaders);

  console.log('✓ Seed complete. Data written to ./data/');
  console.log('');
  console.log('Credentials:');
  console.log('  Admin    -> username: admin     / password: admin123');
  console.log('  Employee -> username: john.doe  / password: employee123');
}

seed().catch(console.error);
