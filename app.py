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
# Ensure AWS credentials and region are loaded correctly from .env
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1') # Default to us-east-1 if not set


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data')
def get_data():
    # Get data from S3
    exam_df = get_data_from_s3('data/exam_data.csv')
    placement_df = get_data_from_s3('data/placement_data.csv')
    faculty_df = get_data_from_s3('data/faculty_reviews.csv')

    # --- Data Cleaning/Standardization ---
    # Handle potential case difference for 'Department' in exam_df
    if not exam_df.empty and 'department' in exam_df.columns and 'Department' not in exam_df.columns:
        print("Info: Renaming 'department' to 'Department' in exam_df.")
        exam_df.rename(columns={'department': 'Department'}, inplace=True)
    # Note: placement_df uses 'department' (lowercase) as per its schema and processing function.
    # Note: faculty_df uses 'Department' (uppercase) as per its schema and processing function.

    # Process exam data (now expects 'Department')
    exam_data = process_exam_data(exam_df)

    # Process placement data (expects 'department')
    placement_data = process_placement_data(placement_df)

    # Process faculty data (expects 'Department')
    faculty_data = process_faculty_data(faculty_df)

    return jsonify({
        'exam_data': exam_data,
        'placement_data': placement_data,
        'faculty_data': faculty_data
    })

def process_exam_data(df):
    if df.empty:
        return {'error': 'Exam data is empty or could not be loaded.'}

    # Map actual columns to expected metrics
    try:
        # Calculate performance by department using marks
        performance_by_department = df.groupby('Department')['marks'].mean().round(2).to_dict()
        
        # Calculate grade distribution by converting marks to letter grades
        def get_grade(mark):
            if mark >= 90: return 'A+'
            elif mark >= 80: return 'A'
            elif mark >= 70: return 'B'
            elif mark >= 60: return 'C'
            elif mark >= 50: return 'D'
            else: return 'F'
        
        df['Grade'] = df['marks'].apply(get_grade)
        grade_distribution = df['Grade'].value_counts().to_dict()
        
        # Group subject performance
        subject_performance = df.groupby('subjects')['marks'].mean().sort_values(ascending=False).head(5).to_dict()
        
        # Split by exam type for internal/external comparison
        marks_comparison = df.groupby('exam_type')['marks'].mean().round(2).to_dict()
        
        # Semester performance (using year_or_semester)
        semester_performance = df.groupby('year_or_semester')['marks'].mean().round(2).to_dict()
        
        # Map exam types if needed
        if 'Internal' not in marks_comparison or 'External' not in marks_comparison:
            marks_comparison = {
                'Internal': marks_comparison.get('internal', 0),
                'External': marks_comparison.get('external', 0)
            }

        return {
            'performance_by_department': performance_by_department,
            'grade_distribution': grade_distribution,
            'subject_performance': subject_performance,
            'marks_comparison': marks_comparison,
            'semester_performance': semester_performance,
            'year_performance': semester_performance  # Using same data since we have year_or_semester
        }

    except Exception as e:
        print(f"Error processing exam data: {e}")
        return {'error': f'Error processing exam data: {e}'}

def process_placement_data(df):
    if df.empty:
        return {'error': 'Placement data is empty or could not be loaded.'}

    # Check required columns
    required_cols = ['department', 'placement', 'package_lpa', 'cgpa', 'company', 'skills', 'gender']
    # Make checks more flexible if some columns are optional
    # For now, assume essential ones like 'department', 'placement', 'package_lpa', 'cgpa' are needed

    # Standardize placement column early
    if 'placement' in df.columns:
         # Convert placement column to numeric (0 or 1) robustly
        if df['placement'].dtype == 'object':
            df['placement'] = df['placement'].map({'Yes': 1, 'No': 0, 'yes': 1, 'no': 0, 'True': 1, 'False': 0, 'true': 1, 'false': 0}).fillna(0).astype(int)
        elif pd.api.types.is_bool_dtype(df['placement']):
            df['placement'] = df['placement'].astype(int)
        elif pd.api.types.is_numeric_dtype(df['placement']):
            # Ensure it's 0 or 1 if numeric
             df['placement'] = df['placement'].apply(lambda x: 1 if pd.notna(x) and x > 0 else 0)
        else:
            print("Warning: Unexpected data type for 'placement' column. Attempting conversion failed.")
            df['placement'] = 0 # Default to 0 if conversion fails


    # --- Safely perform calculations ---
    placement_rate_by_dept = {}
    if 'department' in df.columns and 'placement' in df.columns and pd.api.types.is_numeric_dtype(df['placement']):
         placement_rate_by_dept = df.groupby('department')['placement'].mean().round(2).to_dict()

    package_by_dept = {}
    if 'department' in df.columns and 'package_lpa' in df.columns and pd.api.types.is_numeric_dtype(df['package_lpa']):
         package_by_dept = df.groupby('department')['package_lpa'].mean().round(2).to_dict()

    cgpa_package_data = {'cgpa': [], 'package': []}
    if 'cgpa' in df.columns and 'package_lpa' in df.columns:
         # Ensure only valid pairs are included
         valid_data = df[['cgpa', 'package_lpa']].dropna()
         cgpa_package_data = {
             'cgpa': valid_data['cgpa'].tolist(),
             'package': valid_data['package_lpa'].tolist()
         }


    top_companies = {}
    # Ensure placement column exists and is numeric before filtering
    if 'company' in df.columns and 'placement' in df.columns and pd.api.types.is_numeric_dtype(df['placement']):
        placed_df = df[df['placement'] == 1]
        if not placed_df.empty:
             top_companies = placed_df['company'].value_counts().head(10).to_dict()


    top_skills = {}
    if 'skills' in df.columns and not df['skills'].isna().all():
        try:
            skills_list = []
            for skills in df['skills'].dropna():
                 # Check if skills is a string before splitting
                if isinstance(skills, str):
                     skills_list.extend([skill.strip() for skill in skills.split(',') if skill.strip()]) # Ensure non-empty skills
            if skills_list:
                skill_counts = Counter(skills_list)
                top_skills = {k: v for k, v in sorted(skill_counts.items(), key=lambda item: item[1], reverse=True)[:10]}
        except Exception as e:
            print(f"Error processing skills: {e}")


    gender_placement = {}
    # Ensure gender and placement columns exist and placement is numeric
    if 'gender' in df.columns and 'placement' in df.columns and pd.api.types.is_numeric_dtype(df['placement']):
        try:
            # Use crosstab for potentially cleaner handling of categories
            gender_placement_df = pd.crosstab(df['gender'], df['placement'])
             # Ensure both 0 and 1 columns exist, filling with 0 if necessary
            if 0 not in gender_placement_df.columns: gender_placement_df[0] = 0
            if 1 not in gender_placement_df.columns: gender_placement_df[1] = 0
            # Convert to the expected dict format {gender: {0: count, 1: count}}
            gender_placement = gender_placement_df[[0, 1]].to_dict(orient='index') # Use string keys '0', '1' if needed by JS
            # Or convert keys to string '0', '1' if JS expects that for createStackedBarChart
            gender_placement = {k: {str(k_inner): v_inner for k_inner, v_inner in v.items()} for k, v in gender_placement.items()}


        except Exception as e:
            print(f"Error processing gender placement: {e}")


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
        return {'error': 'Faculty data is empty or could not be loaded.'}

    try:
        # Convert review scores and feedback to ratings
        # Assuming review column contains numeric ratings or can be converted
        df['Rating'] = pd.to_numeric(df['review'], errors='coerce')
        
        # Calculate average ratings by department
        dept_ratings = df.groupby('department')['Rating'].mean().round(2).to_dict()
        
        # Calculate ratings by course
        course_ratings = df.groupby('course_taught')['Rating'].mean().sort_values(ascending=False).head(5).round(2).to_dict()
        
        # Calculate top faculty based on average ratings
        top_faculty = df.groupby('faculty')['Rating'].mean().sort_values(ascending=False).head(5).round(2).to_dict()
        
        # Calculate semester ratings
        semester_ratings = df.groupby('semester')['Rating'].mean().round(2).to_dict()
        
        # Calculate year ratings
        year_ratings = df.groupby('student_year')['Rating'].mean().round(2).to_dict()

        return {
            'avg_ratings': {'Overall_Rating': df['Rating'].mean().round(2)},
            'dept_teaching_ratings': dept_ratings,
            'dept_engagement_ratings': dept_ratings,  # Using same ratings since we don't have separate metrics
            'dept_clarity_ratings': dept_ratings,     # Using same ratings since we don't have separate metrics
            'semester_ratings': semester_ratings,
            'top_faculty': top_faculty,
            'course_ratings': course_ratings,
            'year_ratings': {str(k): {'Rating': v} for k, v in year_ratings.items()}
        }

    except Exception as e:
        print(f"Error processing faculty data: {e}")
        return {'error': f'Error processing faculty data: {e}'}


def get_data_from_s3(file_path):
    # Check if credentials are set
    if not all([AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET]):
        print(f"Error: AWS credentials or S3 bucket name not configured for {file_path}.")
        return pd.DataFrame() # Return empty DataFrame

    try:
        # Initialize S3 client
        s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION
        )

        print(f"Attempting to fetch data from S3: Bucket={S3_BUCKET}, Key={file_path}") # Debug print

        # Get the CSV file from S3
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=file_path)

        # Read the CSV data
        csv_content = response['Body'].read()

        # Convert to pandas DataFrame
        df = pd.read_csv(io.BytesIO(csv_content))
        print(f"Successfully fetched and read {file_path}. Columns: {df.columns.tolist()}") # Debug print

        return df

    except s3_client.exceptions.NoSuchKey:
         print(f"Error: File not found in S3. Bucket: {S3_BUCKET}, Key={file_path}")
         return pd.DataFrame()
    except s3_client.exceptions.ClientError as e:
         if e.response['Error']['Code'] == 'AccessDenied':
             print(f"Error: Access Denied fetching data from S3 ({file_path}). Check IAM permissions.")
         else:
             print(f"AWS Client Error fetching data from S3 ({file_path}): {e}")
         return pd.DataFrame()
    except pd.errors.EmptyDataError:
        print(f"Error: The file {file_path} from S3 is empty.")
        return pd.DataFrame()
    except Exception as e:
        # Catch other potential errors (network issues, malformed CSV, etc.)
        print(f"Generic Error fetching/reading data from S3 ({file_path}): {e}")
        import traceback
        traceback.print_exc() # Print detailed traceback for unexpected errors
        return pd.DataFrame()


if __name__ == '__main__':
    # Use 0.0.0.0 to make it accessible on the network if needed, else 127.0.0.1
    app.run(host='0.0.0.0', port=5000, debug=True) # Port 5000 is default Flask port