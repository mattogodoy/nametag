# NameTag Production Deployment Guide

This guide walks you through deploying NameTag to production.

## Prerequisites

- Docker and Docker Compose installed on production server
- Domain name configured and pointing to your server
- SSL/TLS certificate (e.g., from Let's Encrypt)
- SMTP service account (Resend recommended)
- Minimum server requirements:
  - 2 CPU cores
  - 4GB RAM
  - 20GB storage
  - Ubuntu 20.04+ or similar Linux distribution

## Step 1: Server Setup

### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 1.3 Install Docker Compose
```bash
sudo apt install docker-compose-plugin
```

### 1.4 Configure Firewall
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Step 2: Clone and Configure

### 2.1 Clone Repository
```bash
git clone https://github.com/yourusername/nametag.git
cd nametag
```

### 2.2 Create Environment File
```bash
cp .env.example .env
nano .env
```

### 2.3 Generate Secrets
```bash
# Generate NEXTAUTH_SECRET (32+ characters)
openssl rand -base64 32

# Generate CRON_SECRET (16+ characters)
openssl rand -base64 16

# Generate database password
openssl rand -base64 24
```

### 2.4 Configure Environment Variables
Update `.env` with your production values:

```bash
# Database
DATABASE_URL=postgresql://nametag:YOUR_DB_PASSWORD@db:5432/nametag_db?connection_limit=10&pool_timeout=10
DB_USER=nametag
DB_PASSWORD=YOUR_DB_PASSWORD
DB_NAME=nametag_db

# NextAuth
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=YOUR_GENERATED_SECRET_HERE

# Email (Resend)
RESEND_API_KEY=re_YOUR_API_KEY
EMAIL_DOMAIN=yourdomain.com

# Cron
CRON_SECRET=YOUR_CRON_SECRET_HERE

# Production Settings
NODE_ENV=production
LOG_LEVEL=warn

# Optional: Error Tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

## Step 3: SSL/TLS Setup

### 3.1 Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx
```

### 3.2 Obtain Certificate
```bash
sudo certbot certonly --standalone -d yourdomain.com
```

### 3.3 Configure Nginx (Recommended)

Create `/etc/nginx/sites-available/nametag`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers (additional to app headers)
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/nametag /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 4: Database Setup

### 4.1 Start Database Only
```bash
docker-compose -f docker-compose.prod.yml up -d db
```

### 4.2 Wait for Database to be Ready
```bash
docker-compose -f docker-compose.prod.yml logs -f db
# Wait for "database system is ready to accept connections"
```

### 4.3 Run Migrations
```bash
docker-compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
```

## Step 5: Deploy Application

### 5.1 Build Production Images
```bash
docker-compose -f docker-compose.prod.yml build
```

### 5.2 Start All Services
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 5.3 Verify Health
```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# Check health endpoint
curl http://localhost:3000/api/health

# Check logs
docker-compose -f docker-compose.prod.yml logs -f app
```

## Step 6: Verify Deployment

### 6.1 Test Registration
```bash
curl -X POST https://yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!",
    "name": "Test User"
  }'
```

### 6.2 Test Health Check
```bash
curl https://yourdomain.com/api/health
```

### 6.3 Manual Testing
- [ ] Register a new account
- [ ] Verify email (check inbox)
- [ ] Login
- [ ] Create a person
- [ ] Create a group
- [ ] Create a relationship
- [ ] View dashboard
- [ ] Test graph visualization
- [ ] Export data
- [ ] Change settings

## Step 7: Monitoring Setup

### 7.1 Set Up Log Monitoring
```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f app

# Set up log rotation
sudo nano /etc/docker/daemon.json
```

Add:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### 7.2 Configure Error Tracking
If using Sentry:
1. Create project at sentry.io
2. Add DSN to `.env`
3. Restart application

### 7.3 Set Up Uptime Monitoring
Use services like:
- UptimeRobot (free)
- Pingdom
- StatusCake

Monitor these endpoints:
- `https://yourdomain.com` (main site)
- `https://yourdomain.com/api/health` (health check)

## Step 8: Backup Configuration

### 8.1 Verify Backup Service
```bash
docker-compose -f docker-compose.prod.yml logs -f backup
```

### 8.2 Test Backup
```bash
# Force a manual backup
docker-compose -f docker-compose.prod.yml exec backup /backup.sh
```

### 8.3 Test Restore
```bash
# Stop application
docker-compose -f docker-compose.prod.yml stop app

# Restore from backup
docker-compose -f docker-compose.prod.yml exec db psql -U nametag -d nametag_db < backups/latest_backup.sql

# Restart application
docker-compose -f docker-compose.prod.yml start app
```

### 8.4 Configure Off-Site Backups
Set up rsync or rclone to copy backups to remote storage:

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure (e.g., for AWS S3, Google Drive, etc.)
rclone config

# Create backup script
cat > /usr/local/bin/nametag-backup-sync.sh << 'EOF'
#!/bin/bash
rclone sync /path/to/nametag/backups remote:nametag-backups
EOF

chmod +x /usr/local/bin/nametag-backup-sync.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /usr/local/bin/nametag-backup-sync.sh
```

## Step 9: Cron Job Setup

### 9.1 Verify Cron Container
```bash
docker-compose -f docker-compose.prod.yml logs -f cron
```

### 9.2 Test Reminder Endpoint
```bash
# Get your CRON_SECRET from .env
CRON_SECRET="your-cron-secret-here"

curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/send-reminders
```

## Step 10: Performance Optimization

### 10.1 Enable Gzip Compression (Nginx)
Add to nginx config:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
```

### 10.2 Configure Database Connection Pooling
Already configured in `DATABASE_URL`:
```
?connection_limit=10&pool_timeout=10
```

Adjust based on load.

### 10.3 Set Up CDN (Optional)
For static assets:
- Cloudflare (recommended, free)
- AWS CloudFront
- Fastly

## Step 11: Security Hardening

### 11.1 Restrict Database Access
Update `docker-compose.prod.yml` to not expose port 5432 externally:
```yaml
# Remove or comment out:
# ports:
#   - "5432:5432"
```

### 11.2 Set Up Fail2Ban
```bash
sudo apt install fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 11.3 Enable Automatic Security Updates
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

### 11.4 Regular Security Audits
```bash
# Run npm audit
docker-compose -f docker-compose.prod.yml run --rm app npm audit

# Check for outdated dependencies
docker-compose -f docker-compose.prod.yml run --rm app npm outdated
```

## Step 12: Maintenance Procedures

### 12.1 Updating the Application
```bash
# Pull latest code
git pull origin main

# Rebuild images
docker-compose -f docker-compose.prod.yml build

# Run migrations
docker-compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy

# Restart services with zero downtime
docker-compose -f docker-compose.prod.yml up -d --no-deps --build app

# Verify health
curl http://localhost:3000/api/health
```

### 12.2 Rolling Back
```bash
# Stop current version
docker-compose -f docker-compose.prod.yml down

# Checkout previous version
git checkout <previous-commit-hash>

# Rebuild and start
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Rollback database if needed
docker-compose -f docker-compose.prod.yml exec db psql -U nametag -d nametag_db < backups/<previous-backup>.sql
```

### 12.3 Scaling
To run multiple app instances:

1. Update docker-compose to use replicas:
```yaml
app:
  deploy:
    replicas: 3
```

2. Set up load balancer (Nginx):
```nginx
upstream nametag_backend {
    least_conn;
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
}

server {
    # ... ssl config ...
    location / {
        proxy_pass http://nametag_backend;
        # ... proxy headers ...
    }
}
```

## Troubleshooting

### Application Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Check environment variables
docker-compose -f docker-compose.prod.yml config

# Verify database connection
docker-compose -f docker-compose.prod.yml exec db psql -U nametag -d nametag_db
```

### Database Connection Issues
```bash
# Check database is running
docker-compose -f docker-compose.prod.yml ps db

# Check database logs
docker-compose -f docker-compose.prod.yml logs db

# Verify credentials
echo $DATABASE_URL
```

### Email Not Sending
```bash
# Check Resend API key is valid
curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/domains

# Check application logs for email errors
docker-compose -f docker-compose.prod.yml logs app | grep -i email
```

### High Memory Usage
```bash
# Check container stats
docker stats

# Reduce database connection pool
# Update DATABASE_URL: connection_limit=5

# Increase server resources
```

## Support and Resources

- Documentation: https://github.com/yourusername/nametag/wiki
- Issue Tracker: https://github.com/yourusername/nametag/issues
- Email: support@nametag.one

## Security Disclosure

If you discover a security vulnerability, please email security@nametag.one instead of using the issue tracker.

---

**Last Updated**: December 9, 2025

