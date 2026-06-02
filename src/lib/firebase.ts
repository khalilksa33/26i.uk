// Emulated Firebase layer routing all Firestore and Auth requests to Express REST backend

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role?: string;
  tenantId?: string;
  emailVerified?: boolean;
  isAnonymous?: boolean;
  providerData?: { providerId: string; email: string }[];
}

class EmulatedAuth {
  private listeners: ((user: User | null) => void)[] = [];
  public currentUser: User | null = null;

  constructor() {
    // Load persisted session
    const saved = localStorage.getItem('saas_auth_user');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch (e) {
        this.currentUser = null;
      }
    }
  }

  onAuthStateChanged(callback: (user: User | null) => void) {
    this.listeners.push(callback);
    // Fire immediately with current state
    setTimeout(() => callback(this.currentUser), 0);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  async signOut() {
    this.currentUser = null;
    localStorage.removeItem('saas_auth_user');
    this.notify();
  }

  async mockSignIn(email: string, displayName: string, tenantId: string) {
    // Call backend to sync/create profile
    const uid = 'usr_' + Math.random().toString(36).substring(2, 9);
    const user: User = { uid, email, displayName, tenantId };

    try {
      const res = await fetch('/api/auth/sync-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      if (res.ok) {
        const dbUser = await res.json();
        this.currentUser = dbUser;
      } else {
        this.currentUser = user;
      }
    } catch (e) {
      this.currentUser = user;
    }

    localStorage.setItem('saas_auth_user', JSON.stringify(this.currentUser));
    this.notify();
    return this.currentUser;
  }

  private notify() {
    this.listeners.forEach(l => l(this.currentUser));
  }
}

export const auth = new EmulatedAuth();

export const signInWithGoogle = async () => {
  // Instead of Google auth popup, prompt the user for email and display name for self-contained deployment
  const email = prompt("Enter email address to login/signup:", auth.currentUser?.email || "user@example.com");
  if (!email) throw new Error("Authentication cancelled");
  
  const name = prompt("Enter your Name:", auth.currentUser?.displayName || "Pilgrim");
  if (!name) throw new Error("Authentication cancelled");

  // Detect current subdomain/tenant
  const params = new URLSearchParams(window.location.search);
  const tenantId = params.get('tenant') || window.location.hostname.split('.')[0] || 'default';

  return auth.mockSignIn(email, name, tenantId);
};

// Firestore Mocks
export const db = { type: 'db' };

export interface DocRef {
  type: 'doc';
  collectionName: string;
  id: string;
}

export interface ColRef {
  type: 'collection';
  collectionName: string;
}

export interface QueryRef {
  type: 'query';
  colRef: ColRef;
  conditions: any[];
}

export function doc(database: any, ...paths: string[]): DocRef {
  // If the last argument is options or other data, handle it. In doc() standard usage: doc(db, col, id) or doc(db, col, id, subcol, subid)
  const id = paths.pop() || '';
  const collectionName = paths.join('_');
  return { type: 'doc', collectionName, id };
}

export function collection(database: any, ...paths: string[]): ColRef {
  return { type: 'collection', collectionName: paths.join('_') };
}

export function collectionGroup(database: any, ...paths: string[]): ColRef {
  return { type: 'collection', collectionName: paths.join('_') };
}

export function query(colRef: ColRef, ...conditions: any[]): QueryRef {
  return { type: 'query', colRef, conditions };
}

// Dummy builders
export function where(field: string, operator: string, value: any) {
  return { type: 'where', field, operator, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(n: number) {
  return { type: 'limit', value: n };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export const Timestamp = {
  now: () => ({ toMillis: () => Date.now(), toDate: () => new Date() })
};

// CRUD implementation via HTTP endpoints
export async function setDoc(docRef: DocRef, data: any, options?: { merge?: boolean }) {
  const payload = options?.merge ? { ...data, _merge: true } : data;
  const res = await fetch(`/api/db/${docRef.collectionName}/${docRef.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HTTP Error: ${res.statusText}`);
  return await res.json();
}

export async function addDoc(colRef: ColRef, data: any) {
  const res = await fetch(`/api/db/${colRef.collectionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`HTTP Error: ${res.statusText}`);
  const result = await res.json();
  return { id: result.id };
}

export async function updateDoc(docRef: DocRef, updates: any) {
  const res = await fetch(`/api/db/${docRef.collectionName}/${docRef.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error(`HTTP Error: ${res.statusText}`);
  return await res.json();
}

export async function deleteDoc(docRef: DocRef) {
  const res = await fetch(`/api/db/${docRef.collectionName}/${docRef.id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error(`HTTP Error: ${res.statusText}`);
  return await res.json();
}

// snapshot implementation using short polling
export function onSnapshot(
  target: DocRef | ColRef | QueryRef,
  callback: (snapshot: any) => void,
  errorCallback?: (err: any) => void
) {
  let active = true;
  let timerId: any = null;

  async function fetchSnapshot() {
    try {
      if (target.type === 'doc') {
        const res = await fetch(`/api/db/${target.collectionName}/${target.id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        callback({
          exists: () => data !== null && data !== undefined,
          id: target.id,
          data: () => data
        });
      } else {
        const colName = target.type === 'collection' ? target.collectionName : target.colRef.collectionName;
        // Build query string from conditions
        let url = `/api/db/${colName}`;
        if (target.type === 'query') {
          const params = new URLSearchParams();
          target.conditions.forEach(c => {
            if (c.type === 'where') {
              params.append(`where_${c.field}`, JSON.stringify({ op: c.operator, val: c.value }));
            }
          });
          url += '?' + params.toString();
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const list = await res.json();

        callback({
          empty: list.length === 0,
          docs: list.map((item: any) => ({
            id: item.id || item.uid,
            data: () => item
          }))
        });
      }
    } catch (e) {
      if (errorCallback) errorCallback(e);
      else console.error("Snapshot error:", e);
    }
  }

  fetchSnapshot();

  // Poll every 3 seconds for live dashboard updates
  timerId = setInterval(() => {
    if (active) fetchSnapshot();
  }, 3000);

  return () => {
    active = false;
    if (timerId) clearInterval(timerId);
  };
}

export function handleFirestoreError(err: any, op: any, col: any) {
  console.error(`LocalDB Operation failed: ${op} on ${col}`, err);
}

export const OperationType = {
  GET: 'get',
  LIST: 'list',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  WRITE: 'write'
};

export function onAuthStateChanged(authInstance: any, callback: (user: User | null) => void) {
  return authInstance.onAuthStateChanged(callback);
}
