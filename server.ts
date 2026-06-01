import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
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
  // In a real app, these would be separate services or more complex logic
  app.post("/api/agents/visa/status", (req, res) => {
    const { bookingId } = req.body;
    // Simulate visa processing steps
    res.json({ status: "processing", message: "Visa application submitted to MOFA." });
  });

  // ERP Integration Endpoint
  app.post("/api/sync-erp", async (req, res) => {
    const { leadData } = req.body;
    const ERP_URL = process.env.ERP_URL || "https://erp.iicc.sa";
    const API_KEY = process.env.ERP_API_KEY;
    const API_SECRET = process.env.ERP_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      console.warn("ERP credentials missing. Skipping sync.");
      return res.status(500).json({ status: "error", message: "ERP credentials missing" });
    }

    try {
      // Frappe Lead DocType structure
      // Note: This is an example structure for Frappe
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

  // Biometric Machine Data Sync Endpoint
  // This endpoint can be called by your local biometric machine or local script
  app.post("/api/sync-biometric", async (req, res) => {
    const { biometricData } = req.body;
    const ERP_URL = process.env.ERP_URL || "https://erp.iicc.sa";
    const API_KEY = process.env.ERP_API_KEY;
    const API_SECRET = process.env.ERP_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ status: "error", message: "ERP credentials missing" });
    }

    try {
      // Forwarding biometric data to Frappe (ERP)
      // Custom structure based on your biometric machine needs
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

  // Employee Check-in Sync for Payroll
  app.post("/api/sync-attendance", async (req, res) => {
    const { checkinData } = req.body;
    const ERP_URL = process.env.ERP_URL || "https://erp.iicc.sa";
    const API_KEY = process.env.ERP_API_KEY;
    const API_SECRET = process.env.ERP_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ status: "error", message: "ERP credentials missing" });
    }

    try {
      // Frappe 'Employee Checkin' DocType
      const payload = {
        employee: checkinData.email, // Using email as identifier if mapped correctly, or employee ID
        log_type: checkinData.action === 'check-in' ? 'IN' : 'OUT',
        time: checkinData.timestamp,
        device_id: "UmrahGo App",
        latitude: checkinData.location?.latitude,
        longitude: checkinData.location?.longitude,
        custom_staff_type: checkinData.type // field or international
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
