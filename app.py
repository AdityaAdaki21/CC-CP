# app.py
from flask import Flask, render_template, jsonify
import pandas as pd
import boto3
import io
from dotenv import load_dotenv
import os
from collections import Counter

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# AWS S3 Configuration
S3_BUCKET = 'student-performance-dashboard'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data')
def get_data():
    # Get data from S3
    exam_df = get_data_from_s3('data/exam_data.csv')
    placement_df = get_data_from_s3('data/placement_data.csv')
    faculty_df = get_data_from_s3('data/faculty_reviews.csv')
    
    # Process exam data
    exam_data = process_exam_data(exam_df)
    
    # Process placement data
    placement_data = process_placement_data(placement_df)
    
    # Process faculty data
    faculty_data = process_faculty_data(faculty_df)
    
    return jsonify({
        'exam_data': exam_data,
        'placement_data': placement_data,
        'faculty_data': faculty_data
    })

def process_exam_data(df):
    if df.empty:
        return {}
    
    # Performance by department
    performance_by_department = df.groupby('Department')['Total_Marks'].mean().round(2).to_dict()
    
    # Grade distribution
    grade_distribution = df['Grade'].value_counts().to_dict()
    
    # Top subjects by performance
    subject_performance = df.groupby('Subject_Name')['Total_Marks'].mean().sort_values(ascending=False).head(5).to_dict()
    
    # Internal vs External marks comparison (average)
    marks_comparison = {
        'Internal': df['Internal_Marks'].mean().round(2),
        'External': df['External_Marks'].mean().round(2)
    }
    
    # Performance by semester and year
    semester_performance = df.groupby('Semester')['Total_Marks'].mean().round(2).to_dict()
    year_performance = df.groupby('Year')['Total_Marks'].mean().round(2).to_dict()
    
    return {
        'performance_by_department': performance_by_department,
        'grade_distribution': grade_distribution,
        'subject_performance': subject_performance,
        'marks_comparison': marks_comparison,
        'semester_performance': semester_performance,
        'year_performance': year_performance
    }

def process_placement_data(df):
    if df.empty:
        return {}
    
    # Convert placement column to numeric (if it's boolean or string)
    if df['placement'].dtype == 'object':
        df['placement'] = df['placement'].map({'Yes': 1, 'No': 0, True: 1, False: 0})
    
    # Placement rate by department
    placement_rate_by_dept = df.groupby('department')['placement'].mean().round(2).to_dict()
    
    # Average package by department
    package_by_dept = df.groupby('department')['package_lpa'].mean().round(2).to_dict()
    
    # CGPA to package correlation data
    cgpa_package_data = {
        'cgpa': df['cgpa'].tolist(),
        'package': df['package_lpa'].tolist()
    }
    
    # Top companies by placement count
    top_companies = df[df['placement'] == 1]['company'].value_counts().head(10).to_dict()
    
    # Extract skills and count them
    if 'skills' in df.columns and not df['skills'].isna().all():
        # Split skills and flatten the list
        skills_list = []
        for skills in df['skills'].dropna():
            skills_list.extend([skill.strip() for skill in skills.split(',')])
        
        # Count skills
        skill_counts = Counter(skills_list)
        top_skills = {k: v for k, v in sorted(skill_counts.items(), key=lambda item: item[1], reverse=True)[:10]}
    else:
        top_skills = {}
    
    # Gender-based placement statistics
    if 'gender' in df.columns:
        gender_placement = df.groupby(['gender', 'placement']).size().unstack(fill_value=0).to_dict()
    else:
        gender_placement = {}
    
    return {
        'placement_rate_by_dept': placement_rate_by_dept,
        'package_by_dept': package_by_dept,
        'cgpa_package_data': cgpa_package_data,
        'top_companies': top_companies,
        'top_skills': top_skills,
        'gender_placement': gender_placement
    }

def process_faculty_data(df):
    if df.empty:
        return {}
    
    # Average ratings across all categories
    avg_ratings = {
        'Rating_Teaching': df['Rating_Teaching'].mean().round(2),
        'Rating_Engagement': df['Rating_Engagement'].mean().round(2),
        'Rating_Clarity': df['Rating_Clarity'].mean().round(2),
        'Rating_Punctuality': df['Rating_Punctuality'].mean().round(2)
    }
    
    # Department ratings comparison
    dept_teaching_ratings = df.groupby('Department')['Rating_Teaching'].mean().round(2).to_dict()
    dept_engagement_ratings = df.groupby('Department')['Rating_Engagement'].mean().round(2).to_dict()
    dept_clarity_ratings = df.groupby('Department')['Rating_Clarity'].mean().round(2).to_dict()
    
    # Ratings by semester
    semester_ratings = df.groupby('Semester')['Rating_Teaching'].mean().round(2).to_dict()
    
    # Top rated faculty (by overall average)
    df['Overall_Rating'] = df[['Rating_Teaching', 'Rating_Engagement', 'Rating_Clarity', 'Rating_Punctuality']].mean(axis=1)
    top_faculty = df.groupby('Faculty_Name')['Overall_Rating'].mean().sort_values(ascending=False).head(5).round(2).to_dict()
    
    # Course ratings
    course_ratings = df.groupby('Course_Taught')['Overall_Rating'].mean().sort_values(ascending=False).head(5).round(2).to_dict()
    
    # Year-wise rating trends
    year_ratings = df.groupby('Year')[['Rating_Teaching', 'Rating_Engagement', 'Rating_Clarity', 'Rating_Punctuality']].mean().round(2).to_dict()
    
    return {
        'avg_ratings': avg_ratings,
        'dept_teaching_ratings': dept_teaching_ratings,
        'dept_engagement_ratings': dept_engagement_ratings,
        'dept_clarity_ratings': dept_clarity_ratings,
        'semester_ratings': semester_ratings,
        'top_faculty': top_faculty,
        'course_ratings': course_ratings,
        'year_ratings': year_ratings
    }

def get_data_from_s3(file_path):
    try:
        # Initialize S3 client with credentials from environment variables
        s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )
        
        # Get the CSV file from S3
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=file_path)
        
        # Read the CSV data
        csv_content = response['Body'].read()
        
        # Convert to pandas DataFrame
        df = pd.read_csv(io.BytesIO(csv_content))
        
        return df
    
    except Exception as e:
        print(f"Error fetching data from S3 ({file_path}): {e}")
        # Return empty DataFrame if error occurs
        return pd.DataFrame()

if __name__ == '__main__':
    app.run(debug=True)