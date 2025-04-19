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

    # Ensure required columns exist and marks are numeric
    required_cols = ['Department', 'marks', 'subjects', 'exam_type', 'year_or_semester']
    for col in required_cols:
        if col not in df.columns:
            return {'error': f"Missing required column in exam data: '{col}'"}

    try:
        df['marks'] = pd.to_numeric(df['marks'], errors='coerce')
        df.dropna(subset=['marks'], inplace=True) # Drop rows where marks couldn't be converted
        if df.empty:
            return {'error': 'No valid numeric marks found in exam data.'}

        # --- Process Data ---

        # Performance by department
        performance_by_department = df.groupby('Department')['marks'].mean().round(2).to_dict()

        # Grade distribution
        def get_grade(mark):
            if mark >= 90: return 'A+'
            elif mark >= 80: return 'A'
            elif mark >= 70: return 'B'
            elif mark >= 60: return 'C'
            elif mark >= 50: return 'D'
            else: return 'F'
        df['Grade'] = df['marks'].apply(get_grade)
        grade_distribution = df['Grade'].value_counts().to_dict()

        # Subject performance (Top 5)
        subject_performance = df.groupby('subjects')['marks'].mean().sort_values(ascending=False).head(5).round(2).to_dict()

        # Internal vs External Marks Comparison (Robust handling)
        marks_comparison = {}
        try:
            # Group by lowercase exam_type after handling potential NaN/None
            df['exam_type_lower'] = df['exam_type'].str.lower().fillna('unknown')
            avg_marks_by_type = df.groupby('exam_type_lower')['marks'].mean().round(2)

            # Look for 'internal' and 'external' specifically
            marks_comparison['Internal'] = avg_marks_by_type.get('internal', 0) # Default to 0 if not found
            marks_comparison['External'] = avg_marks_by_type.get('external', 0) # Default to 0 if not found

            if marks_comparison['Internal'] == 0 and marks_comparison['External'] == 0 and not avg_marks_by_type.empty:
                 print("Warning: Could not find specific 'internal' or 'external' keys in exam types. Found types:", avg_marks_by_type.index.tolist())
                 # If you want to pass SOME data anyway, you could map the first two found types, but explicit is better.
                 # Example fallback (use with caution):
                 # found_types = avg_marks_by_type.index.tolist()
                 # if len(found_types) >= 1: marks_comparison['Type1'] = avg_marks_by_type.iloc[0]
                 # if len(found_types) >= 2: marks_comparison['Type2'] = avg_marks_by_type.iloc[1]
            elif marks_comparison['Internal'] == 0 and marks_comparison['External'] == 0:
                print("Warning: No exam type data found for internal/external comparison.")

        except KeyError:
            print("Warning: 'exam_type' column not found or error during processing. Skipping marks comparison.")
            marks_comparison = {'Internal': None, 'External': None} # Signal JS to show error clearly

        # Semester performance
        # Use year_or_semester directly, ensure it's treated as category/string for grouping
        semester_performance = df.groupby(df['year_or_semester'].astype(str))['marks'].mean().round(2).to_dict()

        return {
            'performance_by_department': performance_by_department,
            'grade_distribution': grade_distribution,
            'subject_performance': subject_performance,
            'marks_comparison': marks_comparison,
            'semester_performance': semester_performance,
            # 'year_performance': semester_performance # Removed redundant key unless year has separate meaning
        }

    except Exception as e:
        print(f"Error processing exam data: {e}")
        # Capture traceback for debugging complex errors
        import traceback
        traceback.print_exc()
        return {'error': f'Error processing exam data: {e}'}

# --- (process_placement_data and process_faculty_data remain the same) ---

def process_placement_data(df):
    if df.empty:
        return {'error': 'Placement data is empty or could not be loaded.'}

    # Check required columns
    required_cols = ['department', 'placement', 'package_lpa', 'cgpa', 'company', 'skills', 'gender']
    # Make checks more flexible if some columns are optional
    # For now, assume essential ones like 'department', 'placement', 'package_lpa', 'cgpa' are needed
    missing_cols = [col for col in ['department', 'placement', 'package_lpa', 'cgpa'] if col not in df.columns]
    if missing_cols:
        return {'error': f"Missing essential columns in placement data: {', '.join(missing_cols)}"}


    # Convert numeric columns, coercing errors
    numeric_cols = ['package_lpa', 'cgpa']
    for col in numeric_cols:
        if col in df.columns:
             df[col] = pd.to_numeric(df[col], errors='coerce')
             # Optionally drop rows where essential numerics are NaN if needed
             # df.dropna(subset=[col], inplace=True)

    # Standardize placement column early
    if 'placement' in df.columns:
         # Convert placement column to numeric (0 or 1) robustly
        if df['placement'].dtype == 'object':
            df['placement'] = df['placement'].map({'Yes': 1, 'No': 0, 'yes': 1, 'no': 0, 'True': 1, 'False': 0, 'true': 1, 'false': 0, 1:1, 0:0}).fillna(-1) # Use -1 to track conversion fails
            df['placement'] = df['placement'].astype(int)
            if (df['placement'] == -1).any():
                 print("Warning: Some 'placement' values could not be mapped to 0 or 1.")
                 df['placement'] = df['placement'].replace(-1, 0) # Default unmappable to Not Placed

        elif pd.api.types.is_bool_dtype(df['placement']):
            df['placement'] = df['placement'].astype(int)
        elif pd.api.types.is_numeric_dtype(df['placement']):
            # Ensure it's strictly 0 or 1 if numeric
             df['placement'] = df['placement'].apply(lambda x: 1 if pd.notna(x) and x > 0 else 0)
        else:
            print("Warning: Unexpected data type for 'placement' column. Attempting conversion failed. Defaulting to 0.")
            df['placement'] = 0 # Default to 0 if conversion fails


    # --- Safely perform calculations ---
    placement_rate_by_dept = {}
    if 'department' in df.columns and 'placement' in df.columns and pd.api.types.is_numeric_dtype(df['placement']):
         # Calculate rate only where department is not null/empty
         valid_dept_df = df[df['department'].notna() & (df['department'] != '')]
         if not valid_dept_df.empty:
             placement_rate_by_dept = valid_dept_df.groupby('department')['placement'].mean().round(2).to_dict()
         else:
             print("Warning: No valid department data for placement rate calculation.")

    package_by_dept = {}
    if 'department' in df.columns and 'package_lpa' in df.columns and pd.api.types.is_numeric_dtype(df['package_lpa']):
         # Group by department, calculate mean package where package is valid (not NaN)
         valid_pkg_df = df[df['package_lpa'].notna() & df['department'].notna() & (df['department'] != '')]
         if not valid_pkg_df.empty:
             package_by_dept = valid_pkg_df.groupby('department')['package_lpa'].mean().round(2).to_dict()
         else:
            print("Warning: No valid department/package data for average package calculation.")

    cgpa_package_data = {'cgpa': [], 'package': []}
    if 'cgpa' in df.columns and 'package_lpa' in df.columns:
         # Ensure only valid pairs (non-NaN) are included
         valid_data = df[['cgpa', 'package_lpa']].dropna()
         if not valid_data.empty:
             cgpa_package_data = {
                 'cgpa': valid_data['cgpa'].tolist(),
                 'package': valid_data['package_lpa'].tolist()
             }
         else:
             print("Warning: No valid CGPA/Package pairs found for scatter plot.")


    top_companies = {}
    # Ensure placement column exists and is numeric before filtering
    if 'company' in df.columns and 'placement' in df.columns and pd.api.types.is_numeric_dtype(df['placement']):
        # Filter for placed students and valid company names
        placed_df = df[(df['placement'] == 1) & df['company'].notna() & (df['company'] != '')]
        if not placed_df.empty:
             top_companies = placed_df['company'].value_counts().head(10).to_dict()
        else:
            print("Warning: No valid placement/company data found for top companies.")


    top_skills = {}
    if 'skills' in df.columns and not df['skills'].isna().all():
        try:
            skills_list = []
            # Process skills only for rows where skills is a non-empty string
            valid_skills = df['skills'].dropna().astype(str)
            for skills_str in valid_skills:
                if skills_str: # Check if not empty string
                    skills_list.extend([skill.strip() for skill in skills_str.split(',') if skill.strip()]) # Ensure non-empty skills after split/strip
            if skills_list:
                skill_counts = Counter(skills_list)
                top_skills = {k: v for k, v in sorted(skill_counts.items(), key=lambda item: item[1], reverse=True)[:10]}
            else:
                print("Warning: Skills column processed, but no valid skills found after cleaning.")
        except Exception as e:
            print(f"Error processing skills: {e}")
            top_skills = {'error': 'Skill processing failed'}


    gender_placement = {}
    # Ensure gender and placement columns exist, placement is numeric, gender is not null
    if 'gender' in df.columns and 'placement' in df.columns and pd.api.types.is_numeric_dtype(df['placement']):
        valid_gender_df = df[df['gender'].notna()]
        if not valid_gender_df.empty:
            try:
                # Use crosstab for potentially cleaner handling of categories
                gender_placement_df = pd.crosstab(valid_gender_df['gender'], valid_gender_df['placement'])
                 # Ensure both 0 and 1 columns exist, filling with 0 if necessary
                if 0 not in gender_placement_df.columns: gender_placement_df[0] = 0
                if 1 not in gender_placement_df.columns: gender_placement_df[1] = 0
                # Convert to the expected dict format {gender: {'0': count, '1': count}} - Use STRINGS for keys '0', '1'
                gender_placement = gender_placement_df[[0, 1]].astype(int).to_dict(orient='index')
                # Ensure keys are strings '0', '1'
                gender_placement = {k: {str(k_inner): v_inner for k_inner, v_inner in v.items()} for k, v in gender_placement.items()}

            except Exception as e:
                print(f"Error processing gender placement: {e}")
                gender_placement = {'error': 'Gender processing failed'}
        else:
             print("Warning: No valid gender data for gender placement calculation.")


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

    # Check essential columns - adjust based on your faculty_reviews.csv
    required_cols = ['department', 'course_taught', 'faculty', 'semester', 'student_year', 'review']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        return {'error': f"Missing required columns in faculty data: {', '.join(missing_cols)}"}

    try:
        # Attempt to convert 'review' column to numeric ratings (e.g., 1-5 scale)
        # This is a strong assumption - adjust if 'review' is text sentiment
        df['Rating'] = pd.to_numeric(df['review'], errors='coerce')
        # Handle potential text feedback if needed:
        # For now, just drop rows where conversion to numeric rating failed
        df.dropna(subset=['Rating'], inplace=True)

        if df.empty:
            return {'error': 'No valid numeric ratings found in faculty reviews.'}

        # Limit rating values if necessary (e.g., scale of 1-5)
        # df['Rating'] = df['Rating'].clip(lower=1, upper=5)

        # --- Calculations (Assuming 'Rating' is the key metric) ---

        # Overall average rating - Simplistic, might need refinement based on structure
        # Let's assume a single overall rating is not the primary goal, but ratings per category.
        # Example: If CSV had separate columns like 'Rating_Teaching', 'Rating_Engagement', etc.
        # We would calculate averages for each here.
        # For now, based on a single 'Rating' column:

        # Average rating across all valid reviews
        overall_avg_rating = df['Rating'].mean().round(2)

        # Average ratings by department
        dept_ratings = df.groupby('department')['Rating'].mean().round(2).to_dict()

        # Average ratings by course (Top 5)
        course_ratings = df.groupby('course_taught')['Rating'].mean().sort_values(ascending=False).head(5).round(2).to_dict()

        # Top rated faculty (Top 5)
        top_faculty = df.groupby('faculty')['Rating'].mean().sort_values(ascending=False).head(5).round(2).to_dict()

        # Average rating by semester
        semester_ratings = df.groupby('semester')['Rating'].mean().round(2).to_dict()

        # Average rating by student year (Simulating different aspects - need real cols)
        # Rename student_year for clarity in the output JSON keys if needed
        df.rename(columns={'student_year': 'Year'}, inplace=True)
        # Prepare data for multi-line chart: { year: { category: value } }
        # We only have one 'Rating', so the structure is simple here.
        # If you had multiple rating columns (e.g., Rating_Teaching, Rating_Clarity),
        # you'd group by Year and calculate the mean for each column.
        year_ratings_agg = df.groupby('Year')['Rating'].mean().round(2)
        # Convert to nested dict format expected by createMultiLineChart
        # The JS expects keys like Rating_Teaching, Rating_Engagement etc.
        # We'll synthesize this using our single 'Rating' value. Adapt if you add more real rating types.
        year_ratings_multi = {
            str(year): {
                'Rating_Teaching': rating,  # Using overall rating for all categories as placeholder
                'Rating_Engagement': rating,
                'Rating_Clarity': rating,
                'Rating_Punctuality': rating
            }
            for year, rating in year_ratings_agg.items()
        }


        # Data for Radar Chart (Average ratings by category)
        # Since we only have one 'Rating', the radar chart might be misleading.
        # It's better suited if you have multiple rating aspects (e.g., Teaching, Clarity, etc.)
        # Let's create placeholder data based on the overall average, but this should ideally
        # come from specific rating columns if they exist in your CSV.
        avg_ratings_radar = {
            'Rating_Teaching': overall_avg_rating,
            'Rating_Engagement': overall_avg_rating, # Placeholder
            'Rating_Clarity': overall_avg_rating, # Placeholder
            'Rating_Punctuality': overall_avg_rating # Placeholder
            # Add more categories if your data has them
        }

        return {
            # Use avg_ratings_radar for the 'ratingsChart'
            'avg_ratings': avg_ratings_radar,
            # Use dept_ratings for 'deptRatingsChart'. Assuming this reflects teaching.
            'dept_teaching_ratings': dept_ratings,
            # We don't have separate engagement/clarity ratings per dept, reuse or omit
            # 'dept_engagement_ratings': dept_ratings, # Reusing teaching ratings
            # 'dept_clarity_ratings': dept_ratings, # Reusing teaching ratings
            'semester_ratings': semester_ratings, # For 'facultySemesterChart'
            'top_faculty': top_faculty,           # For 'topFacultyChart'
            'course_ratings': course_ratings,     # For 'courseRatingChart'
            'year_ratings': year_ratings_multi    # For 'ratingTrendsChart' (MultiLine)
        }

    except Exception as e:
        print(f"Error processing faculty data: {e}")
        import traceback
        traceback.print_exc()
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
        if not csv_content:
            print(f"Warning: File {file_path} from S3 is empty.")
            return pd.DataFrame()


        # Convert to pandas DataFrame
        df = pd.read_csv(io.BytesIO(csv_content))
        print(f"Successfully fetched and read {file_path}. Shape: {df.shape}. Columns: {df.columns.tolist()}") # Debug print

        return df

    except s3_client.exceptions.NoSuchKey:
         print(f"Error: File not found in S3. Bucket: {S3_BUCKET}, Key={file_path}")
         return pd.DataFrame()
    except s3_client.exceptions.ClientError as e:
         error_code = e.response.get("Error", {}).get("Code")
         if error_code == 'AccessDenied':
             print(f"Error: Access Denied fetching data from S3 ({file_path}). Check IAM permissions and credentials.")
         elif error_code == 'NoSuchBucket':
              print(f"Error: S3 Bucket '{S3_BUCKET}' not found.")
         else:
             print(f"AWS Client Error fetching data from S3 ({file_path}): {e}")
         return pd.DataFrame()
    except pd.errors.EmptyDataError:
        print(f"Error: The file {file_path} from S3 contained no data or only headers.")
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