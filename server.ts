import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import { db as localDb } from "./database";

dotenv.config();

const getDirname = () => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch (e) {
    return __dirname;
  }
};
const _dirname = getDirname();

async function getTenantErpConfig(tenantId: string) {
  const defaultUrl = process.env.ERP_URL || "https://erp.iicc.sa";
  const defaultKey = process.env.ERP_API_KEY;
  const defaultSecret = process.env.ERP_API_SECRET;

  if (!tenantId || tenantId === 'default') {
    return { url: defaultUrl, key: defaultKey, secret: defaultSecret };
  }

  try {
    const tenant = localDb.find('tenants', t => t.id === tenantId);
    if (tenant && tenant.erpConfig?.url && tenant.erpConfig?.apiKey && tenant.erpConfig?.apiSecret) {
      return {
        url: tenant.erpConfig.url,
        key: tenant.erpConfig.apiKey,
        secret: tenant.erpConfig.apiSecret
      };
    }
  } catch (e) {
    console.error(`Error fetching ERP config for tenant ${tenantId}:`, e);
  }

  return { url: defaultUrl, key: defaultKey, secret: defaultSecret };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // API routes
  
  // Local Database Generic API Endpoints

  // Resolve tenant by subdomain or custom domain mapping
  app.get("/api/tenants/resolve", (req, res) => {
    const host = req.query.host as string;
    if (!host) {
      return res.status(400).json({ error: "Missing host parameter" });
    }

    // 1. Handle localhost or raw IPs (e.g. 192.168.8.59?tenant=nei)
    const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(host);
    if (host === 'localhost' || host === '127.0.0.1' || isIP) {
      const queryTenant = req.query.tenant as string;
      if (queryTenant) {
        const tenant = localDb.find('tenants', t => t.id === queryTenant);
        if (tenant) return res.json(tenant);
      }
      return res.status(404).json({ error: "Tenant not found for IP/localhost query" });
    }

    // 2. Resolve via Custom Domain match first
    const customMatch = localDb.find('tenants', t => t.customDomain === host || t.customDomain === `www.${host}` || host === `www.${t.customDomain}`);
    if (customMatch) {
      return res.json(customMatch);
    }

    // 3. Resolve via Subdomain (e.g. nei.26i.uk -> nei)
    const parts = host.split('.');
    if (parts.length > 2) {
      const sub = parts[0];
      if (sub !== 'www' && sub !== '26i') {
        const subdomainMatch = localDb.find('tenants', t => t.subdomain === sub);
        if (subdomainMatch) {
          return res.json(subdomainMatch);
        }
      }
    }

    // Return 404 if no matching tenant config exists
    res.status(404).json({ error: "Tenant not resolved" });
  });

  // Sync/Create User Profile
  app.post("/api/auth/sync-profile", (req, res) => {
    const user = req.body;
    if (!user.uid) return res.status(400).json({ error: "Missing uid" });
    
    const existing = localDb.find('users', u => u.uid === user.uid);
    if (existing) {
      const updated = localDb.update('users', 'uid', user.uid, {
        displayName: user.displayName || existing.displayName,
        email: user.email || existing.email,
        tenantId: user.tenantId || existing.tenantId
      });
      return res.json(updated);
    } else {
      const defaultRole = user.email === 'ihtsourcing@gmail.com' ? 'superadmin' : 'user';
      const newUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        role: defaultRole,
        tenantId: user.tenantId || 'default',
        createdAt: new Date().toISOString()
      };
      localDb.insert('users', newUser);
      return res.json(newUser);
    }
  });

  // Get single doc
  app.get("/api/db/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    const item = localDb.find(collection as any, (x: any) => (x.id === id || x.uid === id));
    if (!item) return res.status(404).json(null);
    res.json(item);
  });

  // Create/Overwrite single doc
  app.post("/api/db/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    const data = req.body;
    
    // Ensure ID fields are synced with route params
    const idField = collection === 'users' ? 'uid' : 'id';
    data[idField] = id;
    
    const existing = localDb.find(collection as any, (x: any) => x[idField] === id);
    if (existing) {
      const updated = localDb.update(collection as any, idField, id, data);
      res.json(updated);
    } else {
      localDb.insert(collection as any, data);
      res.json(data);
    }
  });

  // Update single doc fields (PATCH)
  app.patch("/api/db/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    const updates = req.body;
    const idField = collection === 'users' ? 'uid' : 'id';
    
    const updated = localDb.update(collection as any, idField, id, updates);
    if (!updated) return res.status(404).json({ error: "Document not found" });
    res.json(updated);
  });

  // Delete single doc
  app.delete("/api/db/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    const idField = collection === 'users' ? 'uid' : 'id';
    const deleted = localDb.delete(collection as any, idField, id);
    res.json({ success: deleted });
  });

  // Create collection item (auto-id)
  app.post("/api/db/:collection", (req, res) => {
    const { collection } = req.params;
    const data = req.body;
    
    const idField = collection === 'users' ? 'uid' : 'id';
    if (!data[idField]) {
      data[idField] = collection.substring(0, 3) + '_' + Math.random().toString(36).substring(2, 9);
    }
    
    localDb.insert(collection as any, data);
    res.json(data);
  });

  // Get collection with optional query filters
  app.get("/api/db/:collection", (req, res) => {
    const { collection } = req.params;
    let list = localDb.getCollection(collection as any);
    
    // Parse query params for filtering
    // Query structure: ?where_field={"op":"==","val":"value"}
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('where_')) {
        const field = key.replace('where_', '');
        try {
          const condition = JSON.parse(req.query[key] as string);
          if (condition.op === '==' || condition.op === '===') {
            list = list.filter((item: any) => item[field] === condition.val);
          }
        } catch (e) {
          // ignore invalid query params
        }
      }
    });

    // Special order by sorting if present
    if (collection === 'bookings') {
      list = [...list].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    res.json(list);
  });

  app.get("/api/health", async (req, res) => {
    const ERP_URL = process.env.ERP_URL || "https://erp.iicc.sa";
    let erpStatus = "offline";
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(ERP_URL, { signal: controller.signal });
      if (response.ok || response.status === 401 || response.status === 403) erpStatus = "online";
      clearTimeout(timeoutId);
    } catch (e) {
      erpStatus = "offline";
    }

    res.json({ status: "ok", erpStatus });
  });

  // Simulated Umrah Agents API
  app.post("/api/agents/visa/status", (req, res) => {
    const { bookingId } = req.body;
    res.json({ status: "processing", message: "Visa application submitted to MOFA." });
  });

  // ERP Integration Endpoint (Tenant Aware)
  app.post("/api/sync-erp", async (req, res) => {
    const { leadData } = req.body;
    const tenantId = leadData?.tenantId || "default";
    const { url: ERP_URL, key: API_KEY, secret: API_SECRET } = await getTenantErpConfig(tenantId);

    if (!API_KEY || !API_SECRET) {
      console.warn(`ERP credentials missing for tenant: ${tenantId}. Skipping sync.`);
      return res.status(500).json({ status: "error", message: "ERP credentials missing" });
    }

    try {
      const payload = {
        first_name: leadData.email.split('@')[0],
        email_id: leadData.email,
        mobile_no: leadData.whatsapp,
        lead_source: "UmrahGo AI Agent",
        description: `Region: ${leadData.region}, Duration: ${leadData.duration}, Departure: ${leadData.departureDate}${leadData.passportData ? `\nPassport: ${leadData.passportData.fullName} (${leadData.passportData.passportNumber}), Exp: ${leadData.passportData.expiryDate}` : ''}`,
        custom_latitude: leadData.location?.latitude,
        custom_longitude: leadData.location?.longitude
      };

      const response = await fetch(`${ERP_URL}/api/resource/Lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `token ${API_KEY}:${API_SECRET}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`ERP returned ${response.status}`);
      }

      const result = await response.json();
      res.json({ status: "success", data: result });
    } catch (error) {
      console.error("ERP Sync Error:", error);
      res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "ERP sync failed" });
    }
  });

  // Biometric Machine Data Sync Endpoint (Tenant Aware)
  app.post("/api/sync-biometric", async (req, res) => {
    const { biometricData } = req.body;
    const tenantId = biometricData?.tenantId || "default";
    const { url: ERP_URL, key: API_KEY, secret: API_SECRET } = await getTenantErpConfig(tenantId);

    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ status: "error", message: "ERP credentials missing" });
    }

    try {
      const response = await fetch(`${ERP_URL}/api/resource/Biometric Log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `token ${API_KEY}:${API_SECRET}`
        },
        body: JSON.stringify({
          employee: biometricData.employee_id,
          timestamp: biometricData.timestamp,
          device_id: biometricData.device_id,
          log_type: biometricData.type || "IN"
        })
      });

      if (!response.ok) {
        throw new Error(`ERP returned ${response.status}`);
      }

      const result = await response.json();
      res.json({ status: "success", data: result });
    } catch (error) {
      console.error("Biometric Sync Error:", error);
      res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Biometric sync failed" });
    }
  });

  // Employee Check-in Sync for Payroll (Tenant Aware)
  app.post("/api/sync-attendance", async (req, res) => {
    const { checkinData } = req.body;
    const tenantId = checkinData?.tenantId || "default";
    const { url: ERP_URL, key: API_KEY, secret: API_SECRET } = await getTenantErpConfig(tenantId);

    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ status: "error", message: "ERP credentials missing" });
    }

    try {
      const payload = {
        employee: checkinData.email,
        log_type: checkinData.action === 'check-in' ? 'IN' : 'OUT',
        time: checkinData.timestamp,
        device_id: "UmrahGo App",
        latitude: checkinData.location?.latitude,
        longitude: checkinData.location?.longitude,
        custom_staff_type: checkinData.type
      };

      const response = await fetch(`${ERP_URL}/api/resource/Employee Checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `token ${API_KEY}:${API_SECRET}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`ERP returned ${response.status}`);
      }

      const result = await response.json();
      res.json({ status: "success", data: result });
    } catch (error) {
      console.error("Attendance Sync Error:", error);
      res.status(500).json({ status: "error", message: error instanceof Error ? error.message : "Attendance sync failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
