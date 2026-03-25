import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export class CsvRepository<T extends object> {
  private readonly filePath: string;

  constructor(fileName: string) {
    this.filePath = path.join(process.cwd(), 'data', fileName);
  }

  readAll(): T[] {
    if (!fs.existsSync(this.filePath)) return [];
    const content = fs.readFileSync(this.filePath, 'utf-8');
    if (!content.trim()) return [];
    return parse(content, { columns: true, skip_empty_lines: true }) as T[];
  }

  writeAll(records: T[], columns?: string[]): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (records.length === 0 && columns) {
      fs.writeFileSync(this.filePath, columns.join(',') + '\n', 'utf-8');
      return;
    }

    const content = stringify(records, { header: true });
    fs.writeFileSync(this.filePath, content, 'utf-8');
  }
}
