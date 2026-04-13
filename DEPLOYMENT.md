# Deployment Guide — Mudhiyan Workshop App

> Stack: Express + SQLite (server) · React + Vite (client) · Nginx · PM2 · Let's Encrypt SSL

---

## Prerequisites

- DigitalOcean account
- Domain registered on GoDaddy
- SSH key pair on your Mac (`~/.ssh/id_rsa.pub`)

---

## Part 1 — Create the Droplet

1. Log in to DigitalOcean → **Create → Droplet**
2. Image: **Ubuntu 24.04 LTS**
3. Plan: **Basic → $6/mo** (1 vCPU · 1 GB RAM)
4. Region: **Frankfurt** (closest to Saudi Arabia)
5. Authentication: **SSH Key** → paste the contents of `~/.ssh/id_rsa.pub`
6. Click **Create Droplet** and note the IP address (e.g. `64.23.xxx.xxx`)

---

## Part 2 — Point GoDaddy Domain to the Droplet

In GoDaddy → DNS Management for your domain, add/edit these records:

| Type | Name | Value              | TTL |
|------|------|--------------------|-----|
| A    | `@`  | `64.23.xxx.xxx`    | 600 |
| A    | `www`| `64.23.xxx.xxx`    | 600 |

DNS propagation takes 5–30 minutes. Continue with the steps below while you wait.

---

## Part 3 — Server Setup

SSH into the droplet:

```bash
ssh root@64.23.xxx.xxx
```

Run the following commands:

```bash
# Update system packages
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 (process manager) and Nginx
npm install -g pm2
apt install -y nginx git

# Install Certbot for SSL
apt install -y certbot python3-certbot-nginx
```

---

## Part 4 — Deploy the App

```bash
# Clone the repository
git clone https://github.com/aliabdulrab7/mudhiyan-workshop.git /var/www/mudhiyan
cd /var/www/mudhiyan

# Install all dependencies
npm install
npm install --prefix server
npm install --prefix client

# Seed the database (creates workshop user + example shop)
node server/seed.js

# Build the React client (replace yourdomain.com with your actual domain)
PUBLIC_HOST=yourdomain.com npm run build --prefix client
```

Create the PM2 config file:

```bash
cat > /var/www/mudhiyan/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'mudhiyan',
    script: 'server/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3737,
      JWT_SECRET: 'REPLACE-WITH-A-RANDOM-64-CHARACTER-SECRET',
      PUBLIC_HOST: 'yourdomain.com'
    }
  }]
}
EOF
```

> **Important:** Replace `REPLACE-WITH-A-RANDOM-64-CHARACTER-SECRET` with a real random string.
> Generate one with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Start the app:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # copy and run the printed command to auto-start on reboot
```

---

## Part 5 — Configure Nginx

```bash
nano /etc/nginx/sites-available/mudhiyan
```

Paste the following (replace `yourdomain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/mudhiyan/client/dist;
    index index.html;

    # Serve built React app — all non-API routes fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy /api/* requests to Express (port 3737)
    location /api/ {
        proxy_pass http://localhost:3737;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable the site and reload Nginx:

```bash
ln -s /etc/nginx/sites-available/mudhiyan /etc/nginx/sites-enabled/
nginx -t          # verify config is valid
systemctl reload nginx
```

---

## Part 6 — Enable SSL (HTTPS)

HTTPS is required for Web Bluetooth (Niimbot printer) and camera access.

Make sure your domain's DNS is pointing to the droplet before running this:

```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts:
- Enter your email address
- Agree to terms of service
- Choose **option 2** to redirect HTTP → HTTPS automatically

Certbot automatically renews the certificate every 90 days.

---

## Part 7 — Verify the Deployment

```bash
# Check Express process is running
pm2 status

# Check API is reachable
curl https://yourdomain.com/api/health
# Expected: {"ok":true}
```

Open `https://yourdomain.com` in Chrome → should redirect to `/login`.

**Default credentials after seed:**

| Role             | Username   | Password    |
|------------------|------------|-------------|
| Workshop manager | `workshop` | `workshop123` |
| Shop employee    | `employee1`| `shop123`   |

---

## CI/CD — Auto-Deploy via GitHub Actions

Every push to `master` automatically runs tests then deploys to your Droplet.

### One-time setup: Add GitHub Secrets

Go to **GitHub → your repo → Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Value |
|-------------|-------|
| `DROPLET_IP` | Your Droplet IP (e.g. `64.23.xxx.xxx`) |
| `SSH_PRIVATE_KEY` | Contents of `~/.ssh/id_rsa` on your Mac |
| `PUBLIC_HOST` | Your domain (e.g. `yourdomain.com`) |

### One-time setup: Allow GitHub to SSH into the Droplet

On your Mac, copy your public key:
```bash
cat ~/.ssh/id_rsa.pub
```

On the Droplet, add it to authorized keys:
```bash
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
```

After this, every `git push` triggers:
1. Backend tests (17 tests) — deploy is blocked if any fail
2. `git pull` + client rebuild + `pm2 restart` on the server
3. Health check — confirms the API responded `{"ok":true}`

### Database backups

A separate workflow runs every day at 2 AM UTC and saves a `.db` snapshot as a GitHub Actions artifact (retained for 30 days). You can also trigger it manually from the Actions tab.

---

## Updating the App After Code Changes

```bash
cd /var/www/mudhiyan
git pull
npm install --prefix client
PUBLIC_HOST=yourdomain.com npm run build --prefix client
pm2 restart mudhiyan
```

---

## Database Backup

The SQLite database is stored at `server/data/workshop.db` on the server (not in git).

To download a backup to your Mac:

```bash
scp root@64.23.xxx.xxx:/var/www/mudhiyan/server/data/workshop.db ./workshop-backup-$(date +%Y%m%d).db
```

Set up a daily automated backup with cron:

```bash
# On the server — backs up daily at 2am
crontab -e
# Add this line:
0 2 * * * cp /var/www/mudhiyan/server/data/workshop.db /var/www/mudhiyan/server/data/workshop-$(date +\%Y\%m\%d).db
```

---

## Troubleshooting

| Issue | Command |
|-------|---------|
| App not starting | `pm2 logs mudhiyan` |
| Nginx error | `nginx -t` then `journalctl -u nginx` |
| SSL certificate error | `certbot renew --dry-run` |
| Check which port Express is on | `ss -tlnp \| grep 3737` |
