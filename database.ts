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
  budgets: any[];
  transactions: any[];
  agents: any[];
  jv_partners: any[];
  jv_campaigns: any[];
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
    },
    {
      id: 'itt',
      name: 'Insight International Travel & Tourism',
      subdomain: 'itt',
      customDomain: 'itt.sa',
      logoUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=200',
      primaryColor: 'hsl(142, 70%, 15%)',
      secondaryColor: 'hsl(45, 100%, 40%)',
      whatsappNumber: '966500861820',
      address: 'Insight Building, Prince Abdel Mohsen Bin Abdel Aziz Road, Madinah Munawarah, KSA',
      saudiCompany: 'Insight Travel & Tourism Company LLC',
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ],
  users: [],
  bookings: [],
  offices: [
    { id: 'off1', tenantId: 'nei', name: 'Makkah Main', whatsappNumber: '966500000000', isActive: true },
    { id: 'off2', tenantId: 'hhtt', name: 'Madinah Main', whatsappNumber: '966511111111', isActive: true },
    { id: 'off3', tenantId: 'itt', name: 'Madinah Markaz Al Mahbooba Office', whatsappNumber: '966500861820', isActive: true }
  ],
  leads: [],
  employee_checkins: [],
  budgets: [
    {
      id: 'b_itt',
      tenantId: 'itt',
      totalRevenueTarget: 105600000,
      totalCostBudget: 98550000,
      totalOpExBudget: 2137303,
      categories: [
        { name: "Salaries & Wages", allocated: 882000, spent: 73500 },
        { name: "Hijratul Haram PK", allocated: 443221, spent: 36935 },
        { name: "Umrah License Guarantee", allocated: 850000, spent: 850000 },
        { name: "Iqama & Work Permits", allocated: 144900, spent: 12075 },
        { name: "Office Rent", allocated: 85000, spent: 7083 },
        { name: "Marketing & Digital Ads", allocated: 100000, spent: 50000 },
        { name: "Capex Depreciation", allocated: 240270, spent: 20023 },
        { name: "Health Insurance", allocated: 16000, spent: 1333 },
        { name: "GOSI Expenses", allocated: 36360, spent: 3030 },
        { name: "Other Operations", allocated: 180152, spent: 17329 }
      ],
      fiscalYear: "2026-2027 / 1448"
    }
  ],
  transactions: [
    {
      id: 'tx_1',
      tenantId: 'itt',
      type: 'deposit',
      amount: 1500000,
      description: 'Initial Operating Capital Deposit',
      category: 'Funding',
      timestamp: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'tx_2',
      tenantId: 'itt',
      type: 'expense',
      amount: 850000,
      description: 'Umrah License Guarantee (Saudi Ministry of Hajj)',
      category: 'Umrah License Guarantee',
      timestamp: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'tx_3',
      tenantId: 'itt',
      type: 'expense',
      amount: 7083,
      description: 'Monthly Office Rent (Makkah & Madinah Hubs)',
      category: 'Office Rent',
      timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
    }
  ],
  agents: [
    {
      id: 'ag_hijrat',
      tenantId: 'itt',
      name: 'Hijratul Haram Travels (Master PK)',
      email: 'lahore@itt.sa',
      role: 'agent',
      isActive: true,
      commissionRate: 8,
      balance: 125000,
      createdAt: new Date().toISOString()
    },
    {
      id: 'ag_sub1',
      tenantId: 'itt',
      parentAgentId: 'ag_hijrat',
      name: 'Karachi Al-Buraq Sub-Agent',
      email: 'karachi@itt.sa',
      role: 'subagent',
      isActive: true,
      commissionRate: 4,
      balance: 45000,
      createdAt: new Date().toISOString()
    }
  ],
  jv_partners: [
    {
      id: 'pt_dunya',
      tenantId: 'itt',
      name: 'Dunya Travel & Tours (Pvt) Ltd',
      country: 'Pakistan',
      ceo: 'Hafiz Farhan Ahmad',
      iataCode: '27345006',
      contactPhone: '923216083911',
      contactEmail: 'fgujjar323@gmail.com',
      isActive: true
    }
  ],
  jv_campaigns: [
    {
      id: 'cp_umrah1448',
      tenantId: 'itt',
      partnerId: 'pt_dunya',
      name: 'Dunya PK - Umrah 1448',
      scope: 'Joint procurement of flights and hotels for 30,000 pilgrims split across Makkah and Madinah.',
      totalValue: 105600000,
      profitSplitRatio: 60, // 60% ITT, 40% Dunya
      ittInvestment: 1500000,
      partnerInvestment: 1000000,
      status: 'Active',
      jmcSignatures: {
        partnerApproved: true,
        tenantApproved: true
      }
    }
  ]
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
