# app.py
from flask import Flask, render_template, jsonify
import pandas as pd
import boto3
import io
from dotenv import load_dotenv
import os
from collections import Counter
import traceback
import numpy as np # Used implicitly by pandas, good to have listed

load_dotenv()

app = Flask(__name__)

# AWS S3 Configuration
S3_BUCKET = os.getenv('S3_BUCKET', 'student-performance-dashboard') # Get from .env or default
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1') # Default to us-east-1 if not set in .env

@app.route('/')
def index():
    """Serves the main HTML dashboard page."""
    return render_template('index.html')

@app.route('/api/data')
def get_data():
    """API endpoint to fetch data from S3 and return processed JSON."""
    # Get data from S3
    exam_df = get_data_from_s3('data/exam_data.csv')
    placement_df = get_data_from_s3('data/placement_data.csv')
    faculty_df = get_data_from_s3('data/faculty_reviews.csv')

    # --- Data Cleaning/Standardization ---
    # Standardize common columns if they exist with different cases/names
    if not exam_df.empty:
        exam_df.columns = exam_df.columns.str.strip().str.lower() # Lowercase columns
        # Rename potential variations (example)
        rename_map_exam = {'dept': 'department', 'exam_ty': 'exam_type'}
        exam_df.rename(columns={k: v for k, v in rename_map_exam.items() if k in exam_df.columns}, inplace=True)

    if not placement_df.empty:
        placement_df.columns = placement_df.columns.str.strip().str.lower()
        rename_map_placement = {'dept': 'department', 'pkg_lpa': 'package_lpa'}
        placement_df.rename(columns={k: v for k, v in rename_map_placement.items() if k in placement_df.columns}, inplace=True)


    if not faculty_df.empty:
        faculty_df.columns = faculty_df.columns.str.strip().str.lower()
        rename_map_faculty = {'fac_name': 'faculty', 'course': 'course_taught', 'dept': 'department'}
        faculty_df.rename(columns={k: v for k, v in rename_map_faculty.items() if k in faculty_df.columns}, inplace=True)

    # Process data
    exam_data = process_exam_data(exam_df)
    placement_data = process_placement_data(placement_df)
    faculty_data = process_faculty_data(faculty_df)

    return jsonify({
        'exam_data': exam_data,
        'placement_data': placement_data,
        'faculty_data': faculty_data
    })

def get_data_from_s3(file_path):
    """Fetches a CSV file from the configured S3 bucket."""
    # Check if credentials are set
    if not all([AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET]):
        print(f"ERROR: AWS credentials or S3 bucket name not fully configured for {file_path}. Check .env file.")
        return pd.DataFrame() # Return empty DataFrame

    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION
        )
        print(f"Attempting to fetch data from S3: Bucket={S3_BUCKET}, Key={file_path}")
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=file_path)
        csv_content = response['Body'].read()
        if not csv_content:
            print(f"Warning: File {file_path} from S3 is empty.")
            return pd.DataFrame()

        # Try reading with default UTF-8, fallback to latin-1
        try:
            df = pd.read_csv(io.BytesIO(csv_content), encoding='utf-8')
        except UnicodeDecodeError:
            print(f"Warning: UTF-8 decoding failed for {file_path}. Trying 'iso-8859-1' (latin-1).")
            df = pd.read_csv(io.BytesIO(csv_content), encoding='iso-8859-1') # or 'latin-1'

        print(f"Successfully fetched and read {file_path}. Shape: {df.shape}. Columns: {df.columns.tolist()}")
        # Standardize column names immediately after reading
        df.columns = df.columns.str.strip().str.lower()
        return df

    except s3_client.exceptions.NoSuchKey:
         print(f"ERROR: File not found in S3. Bucket: {S3_BUCKET}, Key={file_path}")
         return pd.DataFrame()
    except s3_client.exceptions.ClientError as e:
         error_code = e.response.get("Error", {}).get("Code")
         if error_code == 'AccessDenied':
             print(f"ERROR: Access Denied fetching data from S3 ({file_path}). Check IAM permissions and credentials.")
         elif error_code == 'NoSuchBucket':
              print(f"ERROR: S3 Bucket '{S3_BUCKET}' not found.")
         else:
             print(f"ERROR: AWS Client Error fetching data from S3 ({file_path}): {e}")
         return pd.DataFrame()
    except pd.errors.EmptyDataError:
        print(f"ERROR: The file {file_path} from S3 contained no data or only headers.")
        return pd.DataFrame()
    except Exception as e:
        print(f"ERROR: Generic error fetching/reading data from S3 ({file_path}): {e}")
        traceback.print_exc()
        return pd.DataFrame()


def process_exam_data(df):
    """Processes exam data to generate metrics for the dashboard."""
    if df.empty:
        return {'error': 'Exam data is empty or could not be loaded.'}

    # Ensure required columns exist (use lowercase names)
    base_required_cols = ['marks', 'department', 'exam_type', 'date']
    missing_base = [col for col in base_required_cols if col not in df.columns]
    if missing_base:
        return {'error': f"Missing essential exam column(s): {', '.join(missing_base)}"}

    # --- Data Preparation ---
    df['marks'] = pd.to_numeric(df['marks'], errors='coerce')
    df.dropna(subset=['marks'], inplace=True)
    if df.empty:
        return {'error': 'No valid numeric marks found in exam data after cleaning.'}

    overall_avg_mark = df['marks'].mean()

    # Initialize results
    results = {
        'kpi_overall_avg_mark': round(overall_avg_mark, 2) if not pd.isna(overall_avg_mark) else None,
        'performance_by_department': {},
        'grade_distribution': {},
        'subject_performance': {},
        'marks_comparison': {'Internal': None, 'External': None},
        'semester_performance': {} # Note: Actually yearly, key kept for consistency with JS
    }

    try:
        # Performance by department
        results['performance_by_department'] = df.groupby('department')['marks'].mean().round(2).sort_index().to_dict()

        # Grade distribution
        def get_grade(mark):
            mark = float(mark)
            if mark >= 90: return 'A+'
            elif mark >= 80: return 'A'
            elif mark >= 70: return 'B'
            elif mark >= 60: return 'C'
            elif mark >= 40: return 'D'
            else: return 'F'
        df['grade'] = df['marks'].apply(get_grade)
        grade_counts = df['grade'].value_counts()
        grade_order = ['A+', 'A', 'B', 'C', 'D', 'F']
        results['grade_distribution'] = {grade: int(grade_counts.get(grade, 0)) for grade in grade_order}

        # Subject performance (Top 5)
        if 'subjects' in df.columns:
            results['subject_performance'] = df.groupby('subjects')['marks'].mean().nlargest(5).round(2).to_dict()
        else:
             print("Warning: 'subjects' column missing, cannot calculate subject performance.")

        # Internal vs External Marks Comparison
        exam_type_map = {'midterm': 'Internal', 'final': 'External'} # Add more if needed
        df['exam_type_mapped'] = df['exam_type'].fillna('Unknown').astype(str).str.lower().str.strip().map(exam_type_map).fillna('Other')
        avg_marks_by_type = df.groupby('exam_type_mapped')['marks'].mean().round(2)
        results['marks_comparison']['Internal'] = avg_marks_by_type.get('Internal') # get returns None if key absent
        results['marks_comparison']['External'] = avg_marks_by_type.get('External')
        if 'Other' in avg_marks_by_type.index or 'Unknown' in avg_marks_by_type.index:
            print(f"Warning: Some exam types not mapped to Internal/External. Original unique types (sample): {df['exam_type'].unique()[:10]}")

        # Yearly performance trend (from 'date' column)
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df_valid_dates = df.dropna(subset=['date'])
        if not df_valid_dates.empty:
            df_valid_dates['year'] = df_valid_dates['date'].dt.year
            yearly_performance = df_valid_dates.groupby(df_valid_dates['year'].astype(int))['marks'].mean().round(2)
            # Ensure keys are strings and sorted numerically
            results['semester_performance'] = {str(k): v for k, v in yearly_performance.sort_index().to_dict().items()}
        else:
            print("Warning: No valid dates found in 'date' column, cannot calculate yearly performance trend.")

        return results

    except Exception as e:
        print(f"ERROR processing exam data: {e}")
        traceback.print_exc()
        results['error'] = f'Partial data; Error processing exam data: {e}'
        return results


def process_placement_data(df):
    """Processes placement data to generate metrics for the dashboard."""
    if df.empty:
        return {'error': 'Placement data is empty or could not be loaded.'}

    # Ensure required columns exist (use lowercase names)
    required_cols = ['department', 'placement', 'package_lpa', 'cgpa', 'gender']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        return {'error': f"Missing essential placement column(s): {', '.join(missing_cols)}"}

    # --- Data Preparation ---
    numeric_cols = ['package_lpa', 'cgpa']
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    # Drop rows if core analytic columns (CGPA, Package) are invalid numbers
    df.dropna(subset=['cgpa', 'package_lpa'], inplace=True)
    if df.empty:
        return {'error': 'No valid CGPA or Package data found after cleaning.'}

    # --- Standardize 'placement' -> 1 for Placed, 0 for Not Placed ---
    placement_map = {
        'yes': 1, 'no': 0, 'true': 1, 'false': 0, 1: 1, 0: 0, 1.0: 1, 0.0: 0,
        'placed': 1, 'not placed': 0, # Add variations as needed
    }
    df['placement_temp'] = df['placement'].fillna('Unknown')
    if pd.api.types.is_numeric_dtype(df['placement_temp']) or pd.api.types.is_bool_dtype(df['placement_temp']):
        df['placement_numeric'] = df['placement_temp'].map(placement_map)
    else:
        df['placement_numeric'] = df['placement_temp'].astype(str).str.strip().str.lower().map(placement_map)
    # Correct way to fillna and avoid FutureWarning
    df['placement_numeric'] = df['placement_numeric'].fillna(0) # Default unmapped/NaN to 0
    df['placement_numeric'] = df['placement_numeric'].astype(int)
    # Optional: Report unmapped values
    # unmapped_count = df[~df['placement_temp'].astype(str).str.strip().str.lower().isin(placement_map.keys()) & (df['placement_temp'] != 'Unknown')].shape[0]
    # if unmapped_count > 0 : print(f"Warning: ~{unmapped_count} 'placement' values unmapped, defaulted to 0.")
    df.drop(columns=['placement_temp'], inplace=True)

    total_placed = df['placement_numeric'].sum()

    # --- Standardize 'gender' ---
    print(f"DEBUG: Raw unique 'gender' values: {df['gender'].unique()}")
    gender_map = {
        'male': 'Male', 'm': 'Male', 'man': 'Male',
        'female': 'Female', 'f': 'Female', 'woman': 'Female',
        'other': 'Other', 'non-binary': 'Other', # Group less common/specific ones
    }
    df['gender_std'] = df['gender'].fillna('Unknown').astype(str).str.strip().str.lower()
    df['gender_std'] = df['gender_std'].map(gender_map).fillna('Other')
    print(f"DEBUG: Mapped unique 'gender_std' values: {df['gender_std'].unique()}")

    # --- Calculations ---
    overall_placement_rate = df['placement_numeric'].mean()
    placed_valid_package = df[(df['placement_numeric'] == 1)]['package_lpa'] # Already dropped NaN package earlier
    overall_avg_package = placed_valid_package.mean() if not placed_valid_package.empty else 0

    # --- CGPA Distribution ---
    cgpa_distribution = {}
    bins = [0, 7, 8, 9, 10.1] # Upper bound slightly > 10 for inclusion
    labels = ['< 7', '7-8', '8-9', '9+']
    try:
        df['cgpa_bin'] = pd.cut(df['cgpa'], bins=bins, labels=labels, right=False)
        cgpa_counts = df['cgpa_bin'].value_counts().reindex(labels, fill_value=0)
        cgpa_distribution = cgpa_counts.to_dict()
    except Exception as e:
        print(f"ERROR calculating CGPA distribution: {e}")
        cgpa_distribution = {'error': 'Failed'}

    # --- Average CGPA by Placement Status ---
    avg_cgpa_by_placement = {}
    try:
        avg_cgpa = df.groupby('placement_numeric')['cgpa'].mean().round(2)
        avg_cgpa_by_placement = {
            'Not Placed': avg_cgpa.get(0), # Returns None if 0 not present
            'Placed': avg_cgpa.get(1)      # Returns None if 1 not present
        }
        # Keep only valid entries
        avg_cgpa_by_placement = {k: v for k, v in avg_cgpa_by_placement.items() if v is not None}
    except Exception as e:
        print(f"ERROR calculating average CGPA by placement: {e}")
        avg_cgpa_by_placement = {'error': 'Failed'}

    # Initialize results dictionary
    results = {
        'kpi_overall_placement_rate': f"{overall_placement_rate:.1%}" if not pd.isna(overall_placement_rate) else None,
        'kpi_overall_avg_package': round(overall_avg_package, 2) if not pd.isna(overall_avg_package) else None,
        'placement_rate_by_dept': {},
        'package_by_dept': {},
        'cgpa_package_data': {'cgpa': [], 'package': []},
        'top_companies': {},
        'top_skills': {},
        'gender_placement': {},
        'cgpa_distribution': cgpa_distribution,
        'avg_cgpa_by_placement': avg_cgpa_by_placement,
    }

    try:
        # --- Populate remaining results ---
        # Placement Rate by Department (return float 0-1)
        valid_dept_df = df[df['department'].notna() & (df['department'] != '')]
        if not valid_dept_df.empty:
             results['placement_rate_by_dept'] = valid_dept_df.groupby('department')['placement_numeric'].mean().round(3).sort_index().to_dict()

        # Average Package by Department (Placed only)
        placed_students = df[df['placement_numeric'] == 1]
        valid_dept_pkg_df = placed_students[placed_students['department'].notna() & (placed_students['department'] != '')]
        if not valid_dept_pkg_df.empty:
            results['package_by_dept'] = valid_dept_pkg_df.groupby('department')['package_lpa'].mean().round(2).sort_index().to_dict()

        # CGPA vs Package (Placed only)
        valid_scatter_data = placed_students[['cgpa', 'package_lpa']] # Already filtered NaNs
        if not valid_scatter_data.empty:
             results['cgpa_package_data'] = {
                'cgpa': valid_scatter_data['cgpa'].tolist(),
                'package': valid_scatter_data['package_lpa'].tolist()
             }

        # Top Recruiting Companies (Placed only)
        if 'company' in df.columns and total_placed > 0:
            placed_df = placed_students[placed_students['company'].notna() & (placed_students['company'].str.strip() != '')]
            if not placed_df.empty:
                results['top_companies'] = placed_df['company'].str.strip().value_counts().head(10).to_dict()

        # Top Skills (Placed only)
        if 'skills' in df.columns:
             skills_data = placed_students[placed_students['skills'].notna()]['skills']
             if not skills_data.empty:
                try:
                    all_skills = []
                    for skills_str in skills_data.astype(str):
                        split_skills = [s.strip().lower() for s in skills_str.replace(';', ',').replace(' ', ',').split(',') if s.strip()]
                        all_skills.extend(split_skills)
                    if all_skills:
                        skill_counts = Counter(all_skills)
                        results['top_skills'] = {k: v for k, v in sorted(skill_counts.items(), key=lambda item: item[1], reverse=True)[:10]}
                except Exception as e:
                    print(f"ERROR processing skills: {e}")
                    results['top_skills'] = {'error': 'Skill processing failed'}

        # Gender Placement Comparison
        if 'gender_std' in df.columns and df['gender_std'].nunique() > 1 and 'Unknown' not in df['gender_std'].unique():
            try:
                gender_placement_df = pd.crosstab(df['gender_std'], df['placement_numeric'])
                if 0 not in gender_placement_df.columns: gender_placement_df[0] = 0
                if 1 not in gender_placement_df.columns: gender_placement_df[1] = 0
                temp_dict = gender_placement_df[[0, 1]].astype(int).sort_index().to_dict(orient='index')
                results['gender_placement'] = {k: {str(k_inner): v_inner for k_inner, v_inner in v.items()} for k, v in temp_dict.items()}
                # Filter out 'Other' if it has zero total counts
                results['gender_placement'] = {k: v for k, v in results['gender_placement'].items() if k != 'Other' or v.get('0', 0) + v.get('1', 0) > 0}
            except Exception as e:
                print(f"ERROR creating gender placement crosstab: {e}")
                results['gender_placement'] = {'error': 'Gender processing failed'}
        else:
             print("Warning: Not enough distinct mapped gender values for comparison chart.")
             # Don't set an error if it was expected (e.g., missing column handled earlier)
             if 'gender_std' in df.columns and results['gender_placement']=={}: # Only set error if processing *tried* and failed
                 results['gender_placement'] = {'error': 'Insufficient distinct gender values'}

        return results

    except Exception as e:
        print(f"ERROR during placement data calculations: {e}")
        traceback.print_exc()
        results['error'] = f'Partial data; Error in placement calculations: {e}'
        return results


def process_faculty_data(df):
    """Processes faculty review data to generate metrics for the dashboard."""
    if df.empty:
        return {'error': 'Faculty data is empty or could not be loaded.'}

    required_cols = ['review', 'department', 'faculty', 'course_taught', 'semester', 'student_year']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        return {'error': f"Missing required faculty column(s): {', '.join(missing_cols)}"}

    # --- Data Preparation ---
    df['rating'] = pd.to_numeric(df['review'], errors='coerce')
    initial_rows = len(df)
    df.dropna(subset=['rating'], inplace=True)
    if len(df) < initial_rows:
        print(f"Info: Dropped {initial_rows - len(df)} faculty rows due to non-numeric 'review'.")

    rating_min, rating_max = 1, 5 # Assumed scale
    df['rating'] = df['rating'].round().astype(int) # Round to nearest integer for distribution counts
    df = df[df['rating'].between(rating_min, rating_max)] # Keep only valid integer ratings
    if df.empty:
         return {'error': f'No valid faculty ratings found in the range ({rating_min}-{rating_max}).'}

    # --- Calculations ---
    overall_avg_rating = df['rating'].mean() # Keep KPI calculation

    # *** NEW: Calculate Rating Distribution ***
    rating_distribution = {}
    try:
        # Count occurrences of each integer rating (1, 2, 3, 4, 5)
        rating_counts = df['rating'].value_counts()
        # Ensure all possible ratings (1-5) are present in the dict, even if count is 0
        for i in range(rating_min, rating_max + 1):
            rating_distribution[str(i)] = int(rating_counts.get(i, 0)) # Keys as strings for JS/JSON
        # Sort by rating value key
        rating_distribution = dict(sorted(rating_distribution.items(), key=lambda item: int(item[0])))
    except Exception as e:
        print(f"ERROR calculating rating distribution: {e}")
        rating_distribution = {'error': 'Failed to calculate distribution'}


    results = {
        'kpi_overall_avg_rating': round(overall_avg_rating, 2) if not pd.isna(overall_avg_rating) else None,
        # 'avg_ratings_radar': {}, # REMOVE - Radar chart data is no longer generated
        'dept_teaching_ratings': {},
        'semester_ratings': {},
        'yearly_average_trend': {},
        'top_faculty': {},
        'course_ratings': {},
        'rating_distribution': rating_distribution, # *** ADD New data ***
    }

    try:
        # Department Teaching Ratings
        valid_dept_df = df[df['department'].notna() & (df['department'] != '')]
        if not valid_dept_df.empty:
             results['dept_teaching_ratings'] = valid_dept_df.groupby('department')['rating'].mean().round(2).sort_index().to_dict()

        # Semester Rating Comparison
        valid_sem_df = df[df['semester'].notna()]
        if not valid_sem_df.empty:
             # ... (semester sorting logic remains the same) ...
             try:
                results['semester_ratings'] = valid_sem_df.groupby('semester')['rating'].mean().round(2).sort_index(key=lambda x: pd.to_numeric(x.astype(str).str.extract(r'(\d+)$', expand=False), errors='coerce').fillna(float('inf'))).to_dict()
             except: # Fallback to basic string sort
                 results['semester_ratings'] = valid_sem_df.groupby(df['semester'].astype(str))['rating'].mean().round(2).sort_index().to_dict()

        # Overall Faculty Rating Trend (Yearly)
        valid_year_df = df[df['student_year'].notna()]
        if not valid_year_df.empty:
           # ... (yearly trend logic remains the same) ...
           try: # Treat as numeric for sorting if possible
               valid_year_df['year_num'] = pd.to_numeric(valid_year_df['student_year'], errors='coerce')
               # Need to handle inplace on potentially mixed types carefully - assign back
               valid_year_df = valid_year_df.dropna(subset=['year_num']) # Assign back filtered DF
               yearly_trend = valid_year_df.groupby('year_num')['rating'].mean().round(2).sort_index()
               results['yearly_average_trend'] = {str(int(k)): v for k, v in yearly_trend.to_dict().items()} # Keys as strings
           except: # Fallback to string sort
                yearly_trend = valid_year_df.groupby(valid_year_df['student_year'].astype(str))['rating'].mean().round(2).sort_index()
                results['yearly_average_trend'] = yearly_trend.to_dict()

        # Top Rated Faculty
        valid_fac_df = df[df['faculty'].notna() & (df['faculty'] != '')]
        if not valid_fac_df.empty:
             results['top_faculty'] = valid_fac_df.groupby('faculty')['rating'].mean().nlargest(5).round(2).to_dict()

        # Top Rated Courses
        valid_course_df = df[df['course_taught'].notna() & (df['course_taught'] != '')]
        if not valid_course_df.empty:
            results['course_ratings'] = valid_course_df.groupby('course_taught')['rating'].mean().nlargest(5).round(2).to_dict()

        return results

    except Exception as e:
        print(f"ERROR processing faculty data calculations: {e}")
        traceback.print_exc()
        # Ensure essential fields like the distribution are still included, even if partial error
        results['error'] = f'Partial data; Error in faculty calculations: {e}'
        # Make sure distribution is still returned if calculated before error
        if 'rating_distribution' not in results:
            results['rating_distribution'] = rating_distribution # Ensure it's added even on error
        return results

if __name__ == '__main__':
    # Set debug=False for production deployment
    app.run(host='0.0.0.0', port=5000, debug=True)