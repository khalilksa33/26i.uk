import fs from 'fs';
import path from 'path';

const DB_FILE = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'db.json');

// Ensure database directory exists
const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export interface DbSchema {
  tenants: any[];
  users: any[];
  bookings: any[];
  offices: any[];
  leads: any[];
  employee_checkins: any[];
}

const defaultData: DbSchema = {
  tenants: [
    {
      id: 'nei',
      name: 'NEI Umrah Services',
      subdomain: 'nei',
      customDomain: null,
      logoUrl: 'https://images.unsplash.com/photo-1591604129939-f1efa4d8f7ec?auto=format&fit=crop&q=80&w=200',
      primaryColor: 'hsl(142, 70%, 15%)',
      secondaryColor: 'hsl(45, 100%, 40%)',
      whatsappNumber: '966500000000',
      address: 'NEI Building, Makkah',
      saudiCompany: 'NEI Umrah Operators Ltd',
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'hhtt',
      name: 'HHTT Hajj & Umrah',
      subdomain: 'hhtt',
      customDomain: null,
      logoUrl: 'https://images.unsplash.com/photo-1564769662533-4f00a87b4056?auto=format&fit=crop&q=80&w=200',
      primaryColor: 'hsl(220, 80%, 20%)',
      secondaryColor: 'hsl(35, 90%, 50%)',
      whatsappNumber: '966511111111',
      address: 'HHTT Tower, Madinah',
      saudiCompany: 'HHTT Pilgrimage Services',
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ],
  users: [],
  bookings: [],
  offices: [
    { id: 'off1', tenantId: 'nei', name: 'Makkah Main', whatsappNumber: '966500000000', isActive: true },
    { id: 'off2', tenantId: 'hhtt', name: 'Madinah Main', whatsappNumber: '966511111111', isActive: true }
  ],
  leads: [],
  employee_checkins: []
};

class LocalDb {
  private data: DbSchema;

  constructor() {
    if (fs.existsSync(DB_FILE)) {
      try {
        this.data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        // Merge missing tables if any
        this.data = { ...defaultData, ...this.data };
      } catch (e) {
        console.error("Failed to parse database file, resetting to default:", e);
        this.data = { ...defaultData };
        this.save();
      }
    } else {
      this.data = { ...defaultData };
      this.save();
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error("Failed to write to database file:", e);
    }
  }

  getCollection<K extends keyof DbSchema>(key: K): DbSchema[K] {
    return this.data[key];
  }

  find<K extends keyof DbSchema>(key: K, predicate: (item: any) => boolean): DbSchema[K][number] | undefined {
    return this.data[key].find(predicate);
  }

  filter<K extends keyof DbSchema>(key: K, predicate: (item: any) => boolean): DbSchema[K] {
    return this.data[key].filter(predicate);
  }

  insert<K extends keyof DbSchema>(key: K, item: any): any {
    this.data[key].push(item);
    this.save();
    return item;
  }

  update<K extends keyof DbSchema>(key: K, idField: string, idVal: any, updates: any): any {
    const idx = this.data[key].findIndex((item: any) => item[idField] === idVal);
    if (idx !== -1) {
      this.data[key][idx] = { ...this.data[key][idx], ...updates };
      this.save();
      return this.data[key][idx];
    }
    return null;
  }

  delete<K extends keyof DbSchema>(key: K, idField: string, idVal: any): boolean {
    const initialLen = this.data[key].length;
    this.data[key] = this.data[key].filter((item: any) => item[idField] !== idVal);
    this.save();
    return this.data[key].length < initialLen;
  }
}

export const db = new LocalDb();
