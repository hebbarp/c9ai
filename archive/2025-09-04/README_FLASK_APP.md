# Calendar Blocking Flask App

A simple Flask web application for blocking calendar time slots and sending email notifications.

## Features

- Block calendar time with start and end dates
- Add descriptions to blocked time slots
- Send email notifications when calendar is blocked
- View all blocked events in a clean interface
- Delete blocked events
- Responsive web interface using Bootstrap

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure email settings:
   - Copy `.env.example` to `.env`
   - Update email credentials in `.env` file
   - For Gmail, use an App Password instead of your regular password

3. Run the application:
```bash
python app.py
```

4. Open your browser to `http://localhost:5000`

## Usage

1. **Home Page**: View all your blocked calendar events
2. **Block Calendar**: Create new blocked time slots with notifications
3. **Manage Events**: Delete events you no longer need

## Email Configuration

The app supports email notifications via SMTP. Configure these environment variables:

- `SMTP_SERVER`: Your SMTP server (default: smtp.gmail.com)
- `SMTP_PORT`: SMTP port (default: 587)
- `SENDER_EMAIL`: Your email address
- `SENDER_PASSWORD`: Your email password or app password

## Database

The app uses SQLite database (`calendar.db`) which will be created automatically when you first run the application.

## API Endpoints

- `GET /`: Home page with events list
- `GET /block`: Block calendar form
- `POST /block`: Create new blocked time
- `GET /events`: Get all events as JSON
- `DELETE /delete/<id>`: Delete an event