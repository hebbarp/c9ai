from flask import Flask, render_template, request, jsonify, redirect, url_for
from datetime import datetime, timedelta
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import json

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'

# Database setup
def init_db():
    conn = sqlite3.connect('calendar.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS blocked_times
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  start_time TEXT NOT NULL,
                  end_time TEXT NOT NULL,
                  description TEXT,
                  notification_email TEXT,
                  created_at TEXT DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/block', methods=['GET', 'POST'])
def block_calendar():
    if request.method == 'POST':
        data = request.json
        title = data.get('title')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        description = data.get('description', '')
        notification_email = data.get('notification_email', '')
        
        # Save to database
        conn = sqlite3.connect('calendar.db')
        c = conn.cursor()
        c.execute('''INSERT INTO blocked_times 
                     (title, start_time, end_time, description, notification_email)
                     VALUES (?, ?, ?, ?, ?)''',
                  (title, start_time, end_time, description, notification_email))
        conn.commit()
        conn.close()
        
        # Send notification if email provided
        if notification_email:
            send_notification(title, start_time, end_time, notification_email)
        
        return jsonify({'success': True, 'message': 'Calendar blocked successfully'})
    
    return render_template('block.html')

@app.route('/events')
def get_events():
    conn = sqlite3.connect('calendar.db')
    c = conn.cursor()
    c.execute('SELECT * FROM blocked_times ORDER BY start_time')
    events = c.fetchall()
    conn.close()
    
    event_list = []
    for event in events:
        event_list.append({
            'id': event[0],
            'title': event[1],
            'start_time': event[2],
            'end_time': event[3],
            'description': event[4],
            'notification_email': event[5],
            'created_at': event[6]
        })
    
    return jsonify(event_list)

@app.route('/delete/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    conn = sqlite3.connect('calendar.db')
    c = conn.cursor()
    c.execute('DELETE FROM blocked_times WHERE id = ?', (event_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Event deleted successfully'})

def send_notification(title, start_time, end_time, email):
    try:
        # Email configuration (you'll need to set these environment variables)
        smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        sender_email = os.getenv('SENDER_EMAIL')
        sender_password = os.getenv('SENDER_PASSWORD')
        
        if not sender_email or not sender_password:
            print("Email credentials not configured")
            return
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = email
        msg['Subject'] = f"Calendar Blocked: {title}"
        
        body = f"""
        Your calendar has been blocked for the following event:
        
        Title: {title}
        Start Time: {start_time}
        End Time: {end_time}
        
        This is an automated notification from your Calendar Blocking System.
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Send email
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        text = msg.as_string()
        server.sendmail(sender_email, email, text)
        server.quit()
        
        print(f"Notification sent to {email}")
        
    except Exception as e:
        print(f"Failed to send notification: {e}")

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=8080)