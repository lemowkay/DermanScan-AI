"""One-shot reminder run for cron / Windows Task Scheduler (every 5-15 minutes):
    python send_reminders.py
Set REMINDERS_ENABLED=false in the web server's .env so only this job sends them."""
import os
os.environ['REMINDERS_ENABLED'] = 'false'          # never start the in-process loop from here
from app import create_app
from utils.reminders import send_due_reminders

if __name__ == '__main__':
    app = create_app()
    print('Reminders sent: %d' % send_due_reminders(app))
