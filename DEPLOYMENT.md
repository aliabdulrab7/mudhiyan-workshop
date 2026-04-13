# Deployment Guide — Mudhiyan Workshop App

> Stack: Express + SQLite (server) · React + Vite (client) · Nginx · PM2 · Let's Encrypt SSL
> Cloud: AWS EC2 · GoDaddy DNS

---

## Prerequisites

- AWS account
- Domain registered on GoDaddy
- AWS CLI installed on your Mac (`brew install awscli`)

---

## Part 1 — Launch EC2 Instance

### 1.1 Create a Key Pair

In AWS Console → **EC2 → Key Pairs → Create key pair**:

- Name: `mudhiyan-key`
- Type: RSA
- Format: `.pem`
- Click **Create** — the file downloads automatically

Move it to your SSH folder and lock permissions:

```bash
mv ~/Downloads/mudhiyan-key.pem ~/.ssh/mudhiyan-key.pem
chmod 400 ~/.ssh/mudhiyan-key.pem
```

### 1.2 Create a Security Group

In AWS Console → **EC2 → Security Groups → Create security group**:

- Name: `mudhiyan-sg`
- Add inbound rules:

| Type  | Protocol | Port | Source    |
|-------|----------|------|-----------|
| SSH   | TCP      | 22   | My IP     |
| HTTP  | TCP      | 80   | Anywhere  |
| HTTPS | TCP      | 443  | Anywhere  |

### 1.3 Launch the Instance

In AWS Console → **EC2 → Launch Instances**:

- Name: `mudhiyan-workshop`
- AMI: **Ubuntu Server 24.04 LTS** (free tier eligible)
- Instance type: **t3.micro** (~$8/mo) or **t2.micro** (free tier for 12 months)
- Key pair: `mudhiyan-key`
- Security group: `mudhiyan-sg`
- Storage: 20 GB gp3 (default)
- Click **Launch Instance**

### 1.4 Allocate an Elastic IP (Static IP)

Without an Elastic IP, your server IP changes every reboot.

In AWS Console → **EC2 → Elastic IPs → Allocate Elastic IP address**:

- Click **Allocate**
- Select the new IP → **Actions → Associate Elastic IP address**
- Select your `mudhiyan-workshop` instance → **Associate**

Note the Elastic IP address (e.g. `54.123.xxx.xxx`). This is your permanent server IP.

---

## Part 2 — Point GoDaddy Domain to the Instance

In GoDaddy → DNS Management for your domain, add/edit these records:

| Type | Name  | Value           | TTL |
|------|-------|-----------------|-----|
| A    | `@`   | `54.123.xxx.xxx`| 600 |
| A    | `www` | `54.123.xxx.xxx`| 600 |

DNS propagation takes 5–30 minutes. Continue with the steps below while you wait.

---

## Part 3 — Server Setup

SSH into the instance:

```bash
ssh -i ~/.ssh/mudhiyan-key.pem ubuntu@54.123.xxx.xxx
```

> Note: The default user on Ubuntu EC2 is `ubuntu`, not `root`.

Run the following commands:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Install PM2 (process manager) and Nginx
sudo npm install -g pm2
sudo apt install -y nginx git

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

---

## Part 4 — Deploy the App

```bash
# Clone the repository
sudo git clone https://github.com/aliabdulrab7/mudhiyan-workshop.git /var/www/mudhiyan
sudo chown -R ubuntu:ubuntu /var/www/mudhiyan
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

> Generate a secure JWT secret:
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Start the app:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# Copy and run the printed sudo command to auto-start on reboot
```

---

## Part 5 — Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/mudhiyan
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
sudo ln -s /etc/nginx/sites-available/mudhiyan /etc/nginx/sites-enabled/
sudo nginx -t          # verify config is valid
sudo systemctl reload nginx
```

---

## Part 6 — Enable SSL (HTTPS)

HTTPS is required for Web Bluetooth (Niimbot printer) and camera access.

Make sure your domain's DNS is pointing to the Elastic IP before running this:

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
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

| Role             | Username   | Password      |
|------------------|------------|---------------|
| Workshop manager | `workshop` | `workshop123` |
| Shop employee    | `employee1`| `shop123`     |

---

## CI/CD — Auto-Deploy via GitHub Actions

Every push to `master` automatically runs tests then deploys to your EC2 instance.

### One-time setup: Add GitHub Secrets

Go to **GitHub → your repo → Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Value |
|-------------|-------|
| `DROPLET_IP` | Your Elastic IP (e.g. `54.123.xxx.xxx`) |
| `SSH_PRIVATE_KEY` | Contents of `~/.ssh/mudhiyan-key.pem` |
| `PUBLIC_HOST` | Your domain (e.g. `yourdomain.com`) |

To get the private key content:

```bash
cat ~/.ssh/mudhiyan-key.pem
```

Copy the entire output including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`.

### One-time setup: Allow GitHub to SSH as ubuntu

The deploy workflow SSHs as `ubuntu`. Update the workflow's SSH username:

In `.github/workflows/deploy.yml` and `backup.yml`, ensure `username: ubuntu` is set (already configured).

After adding secrets, every `git push` triggers:
1. Backend tests (17 tests) — deploy is blocked if any fail
2. `git pull` + client rebuild + `pm2 restart` on the server
3. Health check — confirms the API responded `{"ok":true}`

### Database backups

A separate workflow runs every day at 2 AM UTC and saves a `.db` snapshot as a GitHub Actions artifact (retained for 30 days). Trigger manually from the Actions tab anytime.

---

## Cost Optimization (Phase 6)

| Resource | Cost | Notes |
|----------|------|-------|
| t2.micro | Free (12 months) → ~$8/mo | Free tier: 750 hrs/mo for first year |
| t3.micro | ~$8/mo | Better performance after free tier |
| Elastic IP | Free when attached | $0.005/hr if unattached — always keep it attached |
| Storage (20 GB gp3) | ~$1.60/mo | |
| Data transfer | ~$0/mo | First 100 GB/mo outbound is free |

**To reduce costs after free tier:**
- Use a **1-year Reserved Instance** for t3.micro → saves ~40% (~$5/mo)
- Set a **billing alert** in AWS → Billing → Budgets → Create budget → alert at $15/mo

---

## Updating the App After Code Changes

```bash
cd /var/www/mudhiyan
git pull
npm install --prefix client
PUBLIC_HOST=yourdomain.com npm run build --prefix client
pm2 restart mudhiyan
```

Or just push to `master` — GitHub Actions handles it automatically.

---

## Database Backup

The SQLite database is stored at `/var/www/mudhiyan/server/data/workshop.db` on the server (not in git).

To download a backup to your Mac:

```bash
scp -i ~/.ssh/mudhiyan-key.pem ubuntu@54.123.xxx.xxx:/var/www/mudhiyan/server/data/workshop.db \
    ./workshop-backup-$(date +%Y%m%d).db
```

---

## Troubleshooting

| Issue | Command |
|-------|---------|
| App not starting | `pm2 logs mudhiyan` |
| Nginx error | `sudo nginx -t` then `sudo journalctl -u nginx` |
| SSL certificate error | `sudo certbot renew --dry-run` |
| Check Express port | `ss -tlnp \| grep 3737` |
| Instance unreachable | Check Security Group inbound rules in AWS Console |
