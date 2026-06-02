# Hosting UmrahGo with Frappe/Bench

Since you are running this application on a local Linux server alongside an ERPNext (Frappe) instance, follow this guide to integrate them seamlessly.

## 1. Running as a Sidecar Service
This application is built with Vite (Frontend) and Express (Backend). It should run as a separate Node.js process.

### Step 1: Configuration
Ensure your `.env` file (or environment variables) points to your local ERP instance:
```env
ERP_URL=https://erp.iicc.sa
ERP_API_KEY=your_api_key
ERP_API_SECRET=your_api_secret
```

### Step 2: Systemd Service
Use the provided `umrahgo.service.example` to create a service in `/etc/systemd/system/umrahgo.service`. This ensures the app starts automatically when the server reboots.

```bash
sudo systemctl enable umrahgo
sudo systemctl start umrahgo
```

## 2. Nginx Integration (Bench)
If you want UmrahGo to be accessible via `itt.sa` while ERPNext is on `erp.iicc.sa`, you can add a custom Nginx configuration.

Create `/etc/nginx/sites-available/umrahgo`:
```nginx
server {
    listen 80;
    server_name itt.sa;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
`sudo ln -s /etc/nginx/sites-available/umrahgo /etc/nginx/sites-enabled/`
`sudo nginx -t && sudo systemctl reload nginx`

## 3. Biometric Machine Sync
The application now exposes a dedicated endpoint for your biometric machines:
**Endpoint**: `POST https://itt.sa/api/sync-biometric`

**Payload Example**:
```json
{
  "biometricData": {
    "employee_id": "EMP-001",
    "timestamp": "2024-03-20 10:00:00",
    "device_id": "Main_Gate_01",
    "type": "IN"
  }
}
```
This data will be automatically pushed to your ERP's `Biometric Log` DocType.

## 4. Customizing the Domain
If you change your domain in the future, update the `VITE_COMPANY_WEBSITE` variable in your build environment.
