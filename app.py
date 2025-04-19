# app.py
from flask import Flask, render_template, jsonify
import pandas as pd
import boto3
import io
from dotenv import load_dotenv
import os
from collections import Counter
import traceback 
load_dotenv()

app = Flask(__name__)

# AWS S3 Configuration
S3_BUCKET = 'student-performance-dashboard'
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
    # Handle potential case difference for 'Department' in exam_df AND RENAME 'exam_ty'
    if not exam_df.empty:
        if 'department' in exam_df.columns and 'Department' not in exam_df.columns:
            print("Info: Renaming 'department' to 'Department' in exam_df.")
            exam_df.rename(columns={'department': 'Department'}, inplace=True)
        # *** FIX: Rename truncated exam type column ***
        if 'exam_ty' in exam_df.columns and 'exam_type' not in exam_df.columns:
             print("Info: Renaming 'exam_ty' to 'exam_type' in exam_df.")
             exam_df.rename(columns={'exam_ty': 'exam_type'}, inplace=True)
        # Check if 'Department' column now exists after potential rename
        if 'Department' not in exam_df.columns:
            print("Error: 'Department' column missing in exam_df even after checks.")
            exam_df = pd.DataFrame() # Prevent processing if essential column is missing

    # Process data - Pass the potentially modified dataframes
    exam_data = process_exam_data(exam_df)
    placement_data = process_placement_data(placement_df)
    faculty_data = process_faculty_data(faculty_df)

    return jsonify({
        'exam_data': exam_data,
        'placement_data': placement_data,
        'faculty_data': faculty_data
    })

def process_exam_data(df):
    if df.empty:
        # Check if it was emptied due to missing Department column earlier
        if 'Department' not in df.columns:
             return {'error': 'Exam data missing required "Department" column.'}
        else:
             return {'error': 'Exam data is empty or could not be loaded.'}


    # Ensure required columns exist (using corrected names and checking for date)
    # Use 'exam_type' now after potential rename. Check for 'date' instead of 'year_or_semester'
    required_cols = ['Department', 'marks', 'subjects', 'exam_type', 'date']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        return {'error': f"Missing required column(s) in exam data: {', '.join(missing_cols)}"}

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

        # Internal vs External Marks Comparison (Map 'midterm'/'final')
        marks_comparison = {}
        try:
            # *** FIX: Map actual exam types to Internal/External ***
            exam_type_map = {'midterm': 'Internal', 'final': 'External'}
            # Use fillna('Unknown') before mapping to handle potential NaNs gracefully
            df['exam_type_mapped'] = df['exam_type'].fillna('Unknown').str.lower().map(exam_type_map).fillna('Other') # Map known, mark others

            avg_marks_by_type = df.groupby('exam_type_mapped')['marks'].mean().round(2)

            marks_comparison['Internal'] = avg_marks_by_type.get('Internal', 0) # Default to 0 if not found
            marks_comparison['External'] = avg_marks_by_type.get('External', 0) # Default to 0 if not found

            if 'Other' in avg_marks_by_type.index:
                 print(f"Warning: Found unmapped exam types grouped as 'Other'. Average mark: {avg_marks_by_type.get('Other')}")
            if marks_comparison['Internal'] == 0 and marks_comparison['External'] == 0 and not avg_marks_by_type.empty:
                 print(f"Warning: Could not map 'midterm' or 'final' to Internal/External. Check data. Found types: {df['exam_type'].unique()}")
            elif marks_comparison['Internal'] == 0 and marks_comparison['External'] == 0 and avg_marks_by_type.empty:
                print("Warning: No exam type data found for internal/external comparison after mapping.")

        except KeyError:
            print("Warning: 'exam_type' column error during processing. Skipping marks comparison.")
            marks_comparison = {'Internal': None, 'External': None} # Signal JS error

        # *** FIX: Semester performance using 'date' column to extract Year ***
        semester_performance = {}
        try:
            df['date'] = pd.to_datetime(df['date'], errors='coerce')
            df.dropna(subset=['date'], inplace=True)
            if not df.empty:
                df['year'] = df['date'].dt.year # Extract year
                # Group by year, ensuring year is treated as a category/string for the dict keys
                semester_performance = df.groupby(df['year'].astype(str))['marks'].mean().round(2).to_dict()
            else:
                 print("Warning: No valid dates found after coercion, cannot calculate yearly performance.")

            if not semester_performance: # Check if dict is empty after processing
                print("Warning: Yearly performance calculation resulted in empty data.")

        except KeyError:
            print("Warning: 'date' column missing, cannot calculate yearly performance trend.")
        except Exception as e:
            print(f"Error calculating yearly performance from date: {e}")


        return {
            'performance_by_department': performance_by_department,
            'grade_distribution': grade_distribution,
            'subject_performance': subject_performance,
            'marks_comparison': marks_comparison,
            'semester_performance': semester_performance, # JS expects this key for the trend chart
        }

    except Exception as e:
        print(f"Error processing exam data: {e}")
        traceback.print_exc()
        return {'error': f'Error processing exam data: {e}'}

# --- (process_placement_data and process_faculty_data need updates too) ---

def process_placement_data(df):
    if df.empty:
        return {'error': 'Placement data is empty or could not be loaded.'}

    # Check required columns - check for lowercase 'department' as seen in logs
    required_cols = ['department', 'placement', 'package_lpa', 'cgpa', 'company', 'skills', 'gender']
    missing_cols = [col for col in ['department', 'placement', 'package_lpa', 'cgpa'] if col not in df.columns]
    if missing_cols:
        return {'error': f"Missing essential columns in placement data: {', '.join(missing_cols)}"}


    # Convert numeric columns, coercing errors
    numeric_cols = ['package_lpa', 'cgpa']
    for col in numeric_cols:
        if col in df.columns:
             df[col] = pd.to_numeric(df[col], errors='coerce')

    # Standardize placement column early
    if 'placement' in df.columns:
        # *** Add DEBUG print to see unique values BEFORE mapping ***
        print(f"Debug: Unique values in 'placement' column before mapping: {df['placement'].unique()}")

        # *** FIX: Expand the mapping based on common values and the warning ***
        placement_map = {
            # Standard Yes/No
            'Yes': 1, 'No': 0, 'yes': 1, 'no': 0,
            # Boolean True/False
            'True': 1, 'False': 0, 'true': 1, 'false': 0,
            # Numeric 1/0
             1: 1, 0: 0,
            # Common variations
            'Placed': 1, 'Not Placed': 0, 'placed': 1, 'not placed': 0,
            # Add any other specific values seen in the debug print above
        }
        # Handle strings and potential numbers robustly
        original_type = df['placement'].dtype
        if pd.api.types.is_object_dtype(original_type) or pd.api.types.is_string_dtype(original_type):
             df['placement_mapped'] = df['placement'].str.strip().map(placement_map)
        elif pd.api.types.is_numeric_dtype(original_type) or pd.api.types.is_bool_dtype(original_type):
             df['placement_mapped'] = df['placement'].map(placement_map)
        else: # Fallback for unexpected types
            df['placement_mapped'] = df['placement'].astype(str).str.strip().map(placement_map)


        # Use fillna(-1) ONLY on the mapped column to identify failures
        df['placement_mapped'] = df['placement_mapped'].fillna(-1).astype(int)

        # Report if any values failed mapping
        failed_mapping_count = (df['placement_mapped'] == -1).sum()
        if failed_mapping_count > 0:
             unmapped_values = df.loc[df['placement_mapped'] == -1, 'placement'].unique()
             print(f"Warning: {failed_mapping_count} 'placement' value(s) could not be mapped to 0 or 1. Unmapped values: {unmapped_values}. Defaulting to 0 (Not Placed).")
             df['placement'] = df['placement_mapped'].replace(-1, 0) # Update the original column AFTER mapping
        else:
            df['placement'] = df['placement_mapped'] # Update original column with successful mapping (0 or 1)

        # Drop the temporary mapped column if needed (optional)
        # df.drop(columns=['placement_mapped'], inplace=True)

    else:
         return {'error': "Missing 'placement' column in placement data."} # Cannot proceed without it


    # --- Safely perform calculations (now using the cleaned 'placement' column) ---
    placement_rate_by_dept = {}
    # Ensure placement column is numeric 0/1 after mapping
    if 'department' in df.columns and pd.api.types.is_numeric_dtype(df['placement']):
         valid_dept_df = df[df['department'].notna() & (df['department'] != '')]
         if not valid_dept_df.empty:
             placement_rate_by_dept = valid_dept_df.groupby('department')['placement'].mean().round(2).to_dict()
         else:
             print("Warning: No valid department data for placement rate calculation.")

    package_by_dept = {}
    if 'department' in df.columns and 'package_lpa' in df.columns and pd.api.types.is_numeric_dtype(df['package_lpa']):
         valid_pkg_df = df[df['package_lpa'].notna() & df['department'].notna() & (df['department'] != '')]
         if not valid_pkg_df.empty:
             package_by_dept = valid_pkg_df.groupby('department')['package_lpa'].mean().round(2).to_dict()
         else:
            print("Warning: No valid department/package data for average package calculation.")

    cgpa_package_data = {'cgpa': [], 'package': []}
    if 'cgpa' in df.columns and 'package_lpa' in df.columns:
         valid_data = df[['cgpa', 'package_lpa']].dropna()
         if not valid_data.empty:
             cgpa_package_data = {
                 'cgpa': valid_data['cgpa'].tolist(),
                 'package': valid_data['package_lpa'].tolist()
             }
         else:
             print("Warning: No valid CGPA/Package pairs found for scatter plot.")


    top_companies = {}
    # *** FIX: Ensure placement column is 0/1 before filtering ***
    if 'company' in df.columns and 'placement' in df.columns and pd.api.types.is_numeric_dtype(df['placement']):
        # Filter for placed students (placement == 1) and valid company names
        placed_df = df[(df['placement'] == 1) & df['company'].notna() & (df['company'].str.strip() != '')] # Added strip()
        if not placed_df.empty:
             top_companies = placed_df['company'].value_counts().head(10).to_dict()
        else:
            # Check if the issue was no one being marked as placed=1
            if (df['placement'] == 1).sum() == 0:
                 print("Warning: No students marked as 'Placed' (placement=1) after mapping. Cannot calculate top companies.")
            else:
                 print("Warning: No valid non-empty company names found for placed students.")


    top_skills = {}
    if 'skills' in df.columns and not df['skills'].isna().all():
        try:
            skills_list = []
            valid_skills = df['skills'].dropna().astype(str)
            for skills_str in valid_skills:
                if skills_str:
                    skills_list.extend([skill.strip() for skill in skills_str.split(',') if skill.strip()])
            if skills_list:
                skill_counts = Counter(skills_list)
                top_skills = {k: v for k, v in sorted(skill_counts.items(), key=lambda item: item[1], reverse=True)[:10]}
            else:
                print("Warning: Skills column processed, but no valid skills found after cleaning.")
        except Exception as e:
            print(f"Error processing skills: {e}")
            top_skills = {'error': 'Skill processing failed'}


    gender_placement = {}
    if 'gender' in df.columns and 'placement' in df.columns and pd.api.types.is_numeric_dtype(df['placement']):
        valid_gender_df = df[df['gender'].notna()]
        if not valid_gender_df.empty:
            try:
                gender_placement_df = pd.crosstab(valid_gender_df['gender'], valid_gender_df['placement'])
                if 0 not in gender_placement_df.columns: gender_placement_df[0] = 0
                if 1 not in gender_placement_df.columns: gender_placement_df[1] = 0
                gender_placement = gender_placement_df[[0, 1]].astype(int).to_dict(orient='index')
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

    # Check essential columns - Use exact names from logs
    required_cols = ['department', 'course_taught', 'faculty', 'semester', 'student_year', 'review']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        return {'error': f"Missing required columns in faculty data: {', '.join(missing_cols)}"}

    try:
        # Convert 'review' column to numeric ratings
        df['Rating'] = pd.to_numeric(df['review'], errors='coerce')
        initial_rows = len(df)
        df.dropna(subset=['Rating'], inplace=True)
        if len(df) < initial_rows:
            print(f"Info: Dropped {initial_rows - len(df)} rows from faculty data due to non-numeric 'review'.")

        if df.empty:
            return {'error': 'No valid numeric ratings found in faculty reviews after cleaning.'}

        # Calculations
        overall_avg_rating = df['Rating'].mean()
        dept_ratings = df.groupby('department')['Rating'].mean().round(2).to_dict()
        course_ratings = df.groupby('course_taught')['Rating'].mean().sort_values(ascending=False).head(5).round(2).to_dict()
        top_faculty = df.groupby('faculty')['Rating'].mean().sort_values(ascending=False).head(5).round(2).to_dict()
        semester_ratings = df.groupby(df['semester'].astype(str))['Rating'].mean().round(2).to_dict()

        # *** MODIFICATION START ***
        # Calculate yearly average rating trend (simple dictionary: year -> avg_rating)
        yearly_average_trend = df.groupby('student_year')['Rating'].mean().round(2).to_dict()
        # Ensure keys are strings
        yearly_average_trend = {str(k): v for k, v in yearly_average_trend.items()}
        # *** MODIFICATION END ***


        # Radar Chart Data
        avg_ratings_radar = {
            'Teaching': overall_avg_rating, # Using overall average
            'Engagement': overall_avg_rating,
            'Clarity': overall_avg_rating,
            'Punctuality': overall_avg_rating
        }
        avg_ratings_radar = {k: round(v, 2) for k,v in avg_ratings_radar.items()}


        return {
            'avg_ratings': avg_ratings_radar,
            'dept_teaching_ratings': dept_ratings,
            'semester_ratings': semester_ratings,
            'top_faculty': top_faculty,
            'course_ratings': course_ratings,
            # *** MODIFICATION: Use the new key for the yearly trend ***
            'yearly_average_trend': yearly_average_trend
            # 'year_ratings': year_ratings_multi # Remove the old complex key
        }

    except Exception as e:
        print(f"Error processing faculty data: {e}")
        traceback.print_exc()
        return {'error': f'Error processing faculty data: {e}'}



# --- (get_data_from_s3 remains the same as previous version) ---
def get_data_from_s3(file_path):
    # Check if credentials are set
    if not all([AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET]):
        print(f"Error: AWS credentials or S3 bucket name not configured for {file_path}.")
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
        df = pd.read_csv(io.BytesIO(csv_content))
        print(f"Successfully fetched and read {file_path}. Shape: {df.shape}. Columns: {df.columns.tolist()}")
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
        print(f"Generic Error fetching/reading data from S3 ({file_path}): {e}")
        traceback.print_exc()
        return pd.DataFrame()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)