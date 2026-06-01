# Custom Domain Setup Guide for UmrahGo

To point your custom domain (e.g., `itt.sa` or `insight-travel.com`) to this application running on your local Linux server via Cloudflare Tunnel:

## 1. Cloudflare Configuration (Recommended)
Since you are already using a Cloudflare (CF) tunnel, following these steps is the easiest way to add a custom domain:

1.  **Add Domain to Cloudflare**: Login to your Cloudflare dashboard and add the domain (itt.sa) if not already there.
2.  **Zero Trust Dashboard**: Go to **Networks** -> **Tunnels**.
3.  **Configure Tunnel**: Select your active tunnel.
4.  **Public Hostname**: Add a new public hostname.
    *   **Subdomain**: (Leave empty for root domain or use `www`)
    *   **Domain**: `itt.sa`
    *   **Service Type**: `HTTP`
    *   **URL**: `localhost:3000` (The port your app is running on)
5.  **Save**: Cloudflare will automatically handle the DNS CNAME and SSL certificates for you.

## 2. Web Server (Nginx) Configuration
If you want to handle it on the server level directly:

1.  **A Record**: Point your domain `A` record to your server's Public IP.
2.  **Nginx Block**:
    ```nginx
    server {
        listen 80;
        server_name itt.sa;

        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```
3.  **SSL**: Use `certbot` for free Let's Encrypt certificates:
    `sudo certbot --nginx -d itt.sa`

## 3. App Configuration
Update your `.env` or Environment Variables:
*   `VITE_COMPANY_WEBSITE=https://itt.sa`
*   `VITE_COMPANY_NAME=Insight Travel & Tourism`
