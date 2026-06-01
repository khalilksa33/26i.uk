export enum BookingStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  PROPOSING = 'proposing',
  CONFIRMED = 'confirmed',
  FAILED = 'failed'
}

export interface TripProposal {
  id: string;
  label: string;
  flight: { 
    outbound: { flightNumber: string; airline: string; sector: string; departure: string; arrival: string };
    inbound: { flightNumber: string; airline: string; sector: string; departure: string; arrival: string };
  };
  makkahHotel: {
    name: string;
    stars: number;
    distanceToHaram: string;
    checkIn: string;
    checkOut: string;
    confirmNo?: string;
  };
  madinahHotel: {
    name: string;
    stars: number;
    distanceToHaram: string;
    checkIn: string;
    checkOut: string;
    confirmNo?: string;
  };
  transport: { name: string; type: string; brn: string };
  buyingPrice: number;
  sellingPrice: number;
}

export interface Office {
  id?: string;
  name: string;
  region: string;
  whatsappNumber: string;
  isActive: boolean;
  createdAt: any;
}

export interface Proposal {
  flightNumber: string;
  airline: string;
  departureTime: string;
  price: number;
}

export interface PassportData {
  fullName: string;
  passportNumber: string;
  expiryDate: string;
  nationality: string;
  dob: string;
  gender?: string;
}

export interface AgentStates {
  ocrAgent: 'idle' | 'working' | 'done' | 'error';
  visaAgent: 'idle' | 'working' | 'done' | 'error';
  flightAgent: 'idle' | 'working' | 'done' | 'error';
  hotelAgent: 'idle' | 'working' | 'done' | 'error';
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  whatsapp: string;
  createdAt: any;
}

export interface Booking {
  id?: string;
  userId: string;
  userEmail: string;
  userWhatsapp: string;
  region?: string;
  duration?: '1 Week' | '2 Weeks' | '4 Weeks';
  status: BookingStatus;
  departureDate: string;
  passportData?: PassportData;
  pilgrims?: { name: string; gender: string; ppNo: string; pax: string; beds: string; visaNo: string; pnr: string }[];
  agentStates: AgentStates;
  proposals?: TripProposal[];
  selectedProposal?: number;
  visa?: {
    status: 'Pending' | 'Issued' | 'Rejected';
    referenceNumber: string;
    issuedAt: any;
  };
  flight?: {
    outbound: { flightNumber: string; airline: string; sector: string; departure: string; arrival: string };
    inbound: { flightNumber: string; airline: string; sector: string; departure: string; arrival: string };
  };
  makkahHotel?: {
    name: string;
    stars: number;
    distanceToHaram: string;
    checkIn?: string;
    checkOut?: string;
    confirmNo?: string;
  };
  madinahHotel?: {
    name: string;
    stars: number;
    distanceToHaram: string;
    checkIn?: string;
    checkOut?: string;
    confirmNo?: string;
  };
  transport?: { name: string; type: string; brn: string };
  location?: { latitude: number; longitude: number; address?: string };
  erpStatus?: 'pending' | 'synced' | 'failed';
  createdAt: any;
  updatedAt: any;
}

export interface AgentLog {
  id?: string;
  userId: string;
  agentName: string;
  message: string;
  status: string;
  timestamp: any;
}

export interface Lead {
  id?: string;
  email: string;
  whatsapp: string;
  region: string;
  duration: string;
  departureDate: string;
  location?: { latitude: number; longitude: number; address?: string };
  erpStatus?: 'pending' | 'synced' | 'failed';
  status: 'new' | 'converted';
  timestamp: any;
  chatHistory?: { role: 'user' | 'assistant'; content: string; timestamp: string }[];
}
