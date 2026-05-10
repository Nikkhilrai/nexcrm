#!/bin/bash
# ─────────────────────────────────────────────────────────────
# NexCRM — One-time GCP VM setup script
# Run this ONCE on a fresh Ubuntu 22.04 e2-micro VM.
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh <your-vm-ip-or-domain> <your-github-repo-url>
#
# Example:
#   ./setup.sh 34.105.123.45 https://github.com/yourname/nexcrm-main.git
# ─────────────────────────────────────────────────────────────
set -e

SERVER_NAME=${1:-"_"}
REPO_URL=${2:-""}
APP_DIR="/home/ubuntu/nexcrm"
LOG_DIR="/var/log/nexcrm"

echo ""
echo "========================================"
echo "  NexCRM VM Setup"
echo "  Server: $SERVER_NAME"
echo "========================================"
echo ""

# ── 1. System update ─────────────────────────────────────────
echo "→ Updating system packages..."
sudo apt-get update -q
sudo apt-get upgrade -y -q

# ── 2. Install dependencies ──────────────────────────────────
echo "→ Installing Python 3.12, Redis, Nginx, Certbot, Git..."
sudo apt-get install -y -q \
    python3.12 \
    python3.12-venv \
    python3-pip \
    redis-server \
    nginx \
    certbot \
    python3-certbot-nginx \
    git \
    supervisor

# ── 3. Start Redis ───────────────────────────────────────────
echo "→ Starting Redis..."
sudo systemctl enable redis-server
sudo systemctl start redis-server

# ── 4. Create log directory ──────────────────────────────────
echo "→ Creating log directory..."
sudo mkdir -p $LOG_DIR
sudo chown ubuntu:ubuntu $LOG_DIR

# ── 5. Clone repository ──────────────────────────────────────
if [ -z "$REPO_URL" ]; then
    echo ""
    echo "⚠️  No repo URL provided."
    echo "   Clone your repo manually:"
    echo "   git clone <your-repo-url> $APP_DIR"
    echo ""
else
    echo "→ Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
fi

# ── 6. Python virtual environment ───────────────────────────
echo "→ Setting up Python virtual environment..."
cd "$APP_DIR/backend"
python3.12 -m venv .venv
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

# ── 7. Environment file ──────────────────────────────────────
if [ ! -f "$APP_DIR/backend/.env" ]; then
    cp "$APP_DIR/backend/.env.example" "$APP_DIR/backend/.env"
    echo ""
    echo "⚠️  Created .env from template."
    echo "   Edit it now before continuing:"
    echo "   nano $APP_DIR/backend/.env"
    echo ""
    echo "   Required values to fill in:"
    echo "   - DJANGO_SECRET_KEY"
    echo "   - DATABASE_URL"
    echo "   - DJANGO_ALLOWED_HOSTS=$SERVER_NAME"
    echo "   - CORS_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app"
    echo "   - DJANGO_DEBUG=False"
    echo ""
    read -p "Press Enter once you have saved .env to continue..."
fi

# ── 8. Django setup ──────────────────────────────────────────
echo "→ Running Django migrations..."
source .venv/bin/activate
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo "→ Creating Django superuser (if needed)..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', '', 'ChangeMe123!')
    print('Superuser created: admin / ChangeMe123!')
else:
    print('Superuser already exists.')
"

# ── 9. Systemd services ──────────────────────────────────────
echo "→ Installing systemd services..."
sudo cp "$APP_DIR/deploy/gunicorn.service"   /etc/systemd/system/nexcrm-gunicorn.service
sudo cp "$APP_DIR/deploy/celery.service"     /etc/systemd/system/nexcrm-celery.service
sudo cp "$APP_DIR/deploy/celerybeat.service" /etc/systemd/system/nexcrm-celerybeat.service

sudo systemctl daemon-reload
sudo systemctl enable nexcrm-gunicorn nexcrm-celery nexcrm-celerybeat
sudo systemctl start  nexcrm-gunicorn nexcrm-celery nexcrm-celerybeat

# ── 10. Nginx ────────────────────────────────────────────────
echo "→ Configuring Nginx..."
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/nexcrm

# Replace server_name placeholder with actual IP/domain
sudo sed -i "s/server_name _;/server_name $SERVER_NAME;/" /etc/nginx/sites-available/nexcrm

sudo ln -sf /etc/nginx/sites-available/nexcrm /etc/nginx/sites-enabled/nexcrm
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# ── 11. Status check ─────────────────────────────────────────
echo ""
echo "========================================"
echo "  Setup complete! Service status:"
echo "========================================"
sudo systemctl status nexcrm-gunicorn  --no-pager -l | tail -5
sudo systemctl status nexcrm-celery    --no-pager -l | tail -5
sudo systemctl status nexcrm-celerybeat --no-pager -l | tail -5
sudo systemctl status nginx            --no-pager -l | tail -3
sudo systemctl status redis-server     --no-pager -l | tail -3

echo ""
echo "✅ NexCRM backend is live at: http://$SERVER_NAME"
echo ""
echo "Next steps:"
echo "  1. Change the admin password: http://$SERVER_NAME/admin/"
echo "  2. Run seed commands if needed:"
echo "     cd $APP_DIR/backend && source .venv/bin/activate"
echo "     python manage.py seed_events && python manage.py seed_tiers"
echo "  3. Set up SSL (free HTTPS):"
echo "     sudo certbot --nginx -d yourdomain.com"
echo ""
