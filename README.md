# CC-CP
# Student Performance Dashboard

A Flask-based web application that visualizes student performance data stored in an AWS S3 bucket.

## Features

- Fetches exam data from AWS S3
- Visualizes performance metrics by department, gender, year, and subject
- Responsive design for desktop and mobile viewing
- Interactive charts with Chart.js

## Project Structure

```
student-performance-dashboard/
├── app.py                  # Flask application
├── .env                    # Environment variables (AWS credentials)
├── requirements.txt        # Python dependencies
├── static/
│   ├── css/
│   │   └── styles.css      # Dashboard styling
│   └── js/
│       └── dashboard.js    # Chart initialization and data handling
└── templates/
    └── index.html          # Dashboard HTML template
```

## Setup Instructions

1. Clone the repository or create the files as shown in the project structure.

2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file in the project root with your AWS credentials:
   ```
   AWS_ACCESS_KEY_ID=your_access_key_id
   AWS_SECRET_ACCESS_KEY=your_secret_access_key
   AWS_REGION=us-east-1
   ```

5. Run the Flask application:
   ```bash
   python app.py
   ```

6. Open your browser and navigate to `http://127.0.0.1:5000/` to view the dashboard.

## AWS S3 Setup

Ensure your S3 bucket is properly configured:
- Bucket name: student-performance-dashboard
- File path: data/exam_data.csv

Your AWS user should have permissions to access the S3 bucket.

## License

MIT