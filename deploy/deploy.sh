#!/bin/bash
# ─────────────────────────────────────────────────────────────
# NexCRM — Redeploy script (run after every code update)
#
# Usage (from the VM):
#   cd /home/ubuntu/nexcrm && ./deploy/deploy.sh
# ─────────────────────────────────────────────────────────────
set -e

APP_DIR="/home/ubuntu/nexcrm"

echo "→ Pulling latest code..."
cd "$APP_DIR"
git pull origin main

echo "→ Installing dependencies..."
cd "$APP_DIR/backend"
source .venv/bin/activate
pip install --quiet -r requirements.txt

echo "→ Running migrations..."
python manage.py migrate --noinput

echo "→ Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "→ Restarting services..."
sudo systemctl restart nexcrm-gunicorn nexcrm-celery nexcrm-celerybeat

echo ""
echo "✅ Deployed successfully!"
sudo systemctl status nexcrm-gunicorn --no-pager -l | tail -3
