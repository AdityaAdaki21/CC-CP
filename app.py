# app.py
from flask import Flask, render_template, jsonify
import pandas as pd
import boto3
import io
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# AWS S3 Configuration
S3_BUCKET = 'student-performance-dashboard'
S3_FILE_PATH = 'data/exam_data.csv'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data')
def get_data():
    # Get data from S3
    df = get_data_from_s3()
    
    # Process data for visualization
    performance_by_department = df.groupby('department')['marks'].mean().round(2).to_dict()
    gender_distribution = df['gender'].value_counts().to_dict()
    
    # Performance by exam_type
    exam_performance = df.groupby('exam_type')['marks'].mean().round(2).to_dict()
    
    # Top subjects by average marks
    top_subjects = df.groupby('subjects')['marks'].mean().sort_values(ascending=False).head(5).to_dict()
    
    # CGPA distribution data
    cgpa_ranges = ['<7.0', '7.0-8.0', '8.0-9.0', '9.0+']
    cgpa_counts = [
        len(df[df['cgpa'] < 7.0]),
        len(df[(df['cgpa'] >= 7.0) & (df['cgpa'] < 8.0)]),
        len(df[(df['cgpa'] >= 8.0) & (df['cgpa'] < 9.0)]),
        len(df[df['cgpa'] >= 9.0])
    ]
    
    # Year/Semester distribution
    year_distribution = df['year_or_semester'].value_counts().sort_index().to_dict()
    
    # Marks distribution
    marks_ranges = ['0-25', '26-50', '51-75', '76-100']
    marks_counts = [
        len(df[df['marks'] <= 25]),
        len(df[(df['marks'] > 25) & (df['marks'] <= 50)]),
        len(df[(df['marks'] > 50) & (df['marks'] <= 75)]),
        len(df[df['marks'] > 75])
    ]
    
    return jsonify({
        'performance_by_department': performance_by_department,
        'gender_distribution': gender_distribution,
        'exam_performance': exam_performance,
        'top_subjects': top_subjects,
        'cgpa_distribution': {
            'labels': cgpa_ranges,
            'data': cgpa_counts
        },
        'year_distribution': year_distribution,
        'marks_distribution': {
            'labels': marks_ranges,
            'data': marks_counts
        }
    })

def get_data_from_s3():
    try:
        # Initialize S3 client with credentials from environment variables
        s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )
        
        # Get the CSV file from S3
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=S3_FILE_PATH)
        
        # Read the CSV data
        csv_content = response['Body'].read()
        
        # Convert to pandas DataFrame
        df = pd.read_csv(io.BytesIO(csv_content))
        
        return df
    
    except Exception as e:
        print(f"Error fetching data from S3: {e}")
        # Return sample data or empty DataFrame if error occurs
        return pd.DataFrame()

if __name__ == '__main__':
    app.run(debug=True)