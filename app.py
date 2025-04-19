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

# --- Gemini Integration ---
import google.generativeai as genai
# ------------------------

load_dotenv()

app = Flask(__name__)

# AWS S3 Configuration
S3_BUCKET = os.getenv('S3_BUCKET', 'student-performance-dashboard') # Get from .env or default
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1') # Default to us-east-1 if not set in .env

# --- Gemini Configuration ---
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        print("Gemini API Key configured successfully.")
    except Exception as e:
        print(f"ERROR configuring Gemini API: {e}. Disabling Gemini features.")
        GEMINI_API_KEY = None # Disable if configuration fails
else:
    print("Warning: GEMINI_API_KEY not found in .env file. Gemini features will be disabled.")
# --------------------------


# --- Gemini Helper Function ---
def generate_gemini_summary(prompt_text, model_name="gemini-1.5-flash"):
    """Calls the Gemini API to generate content based on the prompt."""
    if not GEMINI_API_KEY:
        return {"error": "Gemini API key not configured or configuration failed."}
    try:
        print(f"\n--- Sending Prompt to Gemini ({model_name}) ---")
        # print(f"Prompt: {prompt_text[:500]}...") # Log truncated prompt for debugging
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt_text)

        # Basic error check (structure may vary slightly between models/versions)
        if hasattr(response, 'text') and response.text:
            print("--- Gemini Response Received ---")
            return {"summary": response.text.strip()}
        elif response.prompt_feedback and hasattr(response.prompt_feedback, 'block_reason'):
             block_reason = response.prompt_feedback.block_reason
             print(f"ERROR: Gemini prompt blocked. Reason: {block_reason}")
             return {"error": f"Content generation blocked by API. Reason: {block_reason}"}
        else:
             # Log the full response for debugging if text is missing
             print(f"ERROR: Gemini response generation failed or returned empty. Full response: {response}")
             return {"error": "Gemini response generation failed or was empty."}

    except Exception as e:
        print(f"ERROR calling Gemini API: {e}")
        traceback.print_exc()
        # Provide more specific error messages if possible
        if "API key not valid" in str(e):
             return {"error": "Invalid Gemini API Key."}
        elif "Quota" in str(e):
             return {"error": "Gemini API Quota exceeded."}
        return {"error": f"Failed to call Gemini API: {str(e)}"}
# --------------------------


@app.route('/')
def index():
    """Serves the main HTML dashboard page."""
    return render_template('index.html')

@app.route('/api/data')
def get_data():
    """API endpoint to fetch data from S3, process it, and generate AI summaries."""
    # Get data from S3
    exam_df = get_data_from_s3('data/exam_data.csv')
    placement_df = get_data_from_s3('data/placement_data.csv')
    faculty_df = get_data_from_s3('data/faculty_reviews.csv')

    # --- Data Cleaning/Standardization (Keep as is) ---
    # Standardize common columns if they exist with different cases/names
    if not exam_df.empty:
        exam_df.columns = exam_df.columns.str.strip().str.lower() # Lowercase columns
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

    # --- Generate Summaries using Gemini ---

    # Exam Summary
    if 'error' not in exam_data:
        prompt_exam = create_exam_summary_prompt(exam_data)
        gemini_result = generate_gemini_summary(prompt_exam)
        if 'summary' in gemini_result:
            exam_data['gemini_summary'] = gemini_result['summary']
        else:
            exam_data['gemini_summary_error'] = gemini_result['error']
    else:
         exam_data['gemini_summary_error'] = "Summary skipped due to data processing error."


    # Placement Summary
    if 'error' not in placement_data:
        prompt_placement = create_placement_summary_prompt(placement_data)
        gemini_result = generate_gemini_summary(prompt_placement)
        if 'summary' in gemini_result:
            placement_data['gemini_summary'] = gemini_result['summary']
        else:
            placement_data['gemini_summary_error'] = gemini_result['error']
    else:
        placement_data['gemini_summary_error'] = "Summary skipped due to data processing error."

    # Faculty Summary
    if 'error' not in faculty_data:
        prompt_faculty = create_faculty_summary_prompt(faculty_data)
        gemini_result = generate_gemini_summary(prompt_faculty)
        if 'summary' in gemini_result:
            faculty_data['gemini_summary'] = gemini_result['summary']
        else:
            faculty_data['gemini_summary_error'] = gemini_result['error']
    else:
        faculty_data['gemini_summary_error'] = "Summary skipped due to data processing error."

    # ------------------------------------

    return jsonify({
        'exam_data': exam_data,
        'placement_data': placement_data,
        'faculty_data': faculty_data
    })

# --- S3 Data Fetching (Keep as is) ---
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


# --- Data Processing Functions (Keep as is, but ensure they return useful dicts) ---
# process_exam_data(df)
# process_placement_data(df)
# process_faculty_data(df)
# (Assuming these functions are the same as in the original prompt,
#  returning dictionaries with keys like 'kpi_overall_avg_mark',
#  'performance_by_department', 'top_companies', etc.)
# Make sure the processing functions handle missing sub-keys gracefully if needed
# for the prompt creation functions below. E.g. using .get(key, default_value)

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
             results['subject_performance'] = {'error': 'Subjects column missing'}


        # Internal vs External Marks Comparison
        # More robust mapping to handle variations
        df['exam_type_mapped'] = 'Other' # Default
        if 'exam_type' in df.columns:
            df['exam_type_str'] = df['exam_type'].fillna('Unknown').astype(str).str.lower().str.strip()
            internal_patterns = ['internal', 'midterm', 'mid term', 'mid', 'mst']
            external_patterns = ['external', 'final', 'endterm', 'end term', 'end', 'est']
            df.loc[df['exam_type_str'].isin(internal_patterns), 'exam_type_mapped'] = 'Internal'
            df.loc[df['exam_type_str'].isin(external_patterns), 'exam_type_mapped'] = 'External'

        avg_marks_by_type = df.groupby('exam_type_mapped')['marks'].mean().round(2)
        results['marks_comparison']['Internal'] = avg_marks_by_type.get('Internal') # get returns None if key absent
        results['marks_comparison']['External'] = avg_marks_by_type.get('External')
        if 'Other' in avg_marks_by_type.index:
            print(f"Warning: Some exam types mapped to 'Other'. Original unique types (sample): {df['exam_type'].unique()[:10]}")

        # Yearly performance trend (from 'date' column)
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'], errors='coerce')
            df_valid_dates = df.dropna(subset=['date'])
            if not df_valid_dates.empty:
                df_valid_dates['year'] = df_valid_dates['date'].dt.year
                yearly_performance = df_valid_dates.groupby(df_valid_dates['year'].astype(int))['marks'].mean().round(2)
                # Ensure keys are strings and sorted numerically
                results['semester_performance'] = {str(k): v for k, v in yearly_performance.sort_index().to_dict().items()}
            else:
                print("Warning: No valid dates found in 'date' column, cannot calculate yearly performance trend.")
                results['semester_performance'] = {'error': 'No valid dates'}
        else:
             print("Warning: 'date' column missing, cannot calculate yearly performance trend.")
             results['semester_performance'] = {'error': 'Date column missing'}


        return results

    except Exception as e:
        print(f"ERROR processing exam data: {e}")
        traceback.print_exc()
        results['error'] = f'Partial data; Error processing exam data: {str(e)}'
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
        if col in df.columns:
             df[col] = pd.to_numeric(df[col], errors='coerce')
        else: # Should not happen due to check above, but defensive
             return {'error': f"Critical column '{col}' missing during numeric conversion."}

    # Drop rows if core analytic columns (CGPA, Package) are invalid numbers
    df.dropna(subset=['cgpa', 'package_lpa'], inplace=True)
    if df.empty:
        return {'error': 'No valid CGPA or Package data found after cleaning.'}

    # --- Standardize 'placement' -> 1 for Placed, 0 for Not Placed ---
    placement_map = {
        'yes': 1, 'no': 0, 'true': 1, 'false': 0, 1: 1, 0: 0, '1': 1, '0': 0,
        'placed': 1, 'not placed': 0, '1.0': 1, '0.0': 0, # Added string versions
    }
    df['placement_temp'] = df['placement'].fillna('Unknown').astype(str).str.strip().str.lower()
    df['placement_numeric'] = df['placement_temp'].map(placement_map).fillna(0).astype(int) # Default unmapped/NaN to 0
    unmapped_count = df[~df['placement_temp'].isin(placement_map.keys()) & (df['placement_temp'] != 'unknown')].shape[0]
    if unmapped_count > 0 : print(f"Warning: {unmapped_count} 'placement' values unmapped, defaulted to 'Not Placed' (0). Unique unmapped (sample): {df[~df['placement_temp'].isin(placement_map.keys()) & (df['placement_temp'] != 'unknown')]['placement_temp'].unique()[:5]}")
    df.drop(columns=['placement_temp'], inplace=True)

    total_placed = df['placement_numeric'].sum()

    # --- Standardize 'gender' ---
    # print(f"DEBUG: Raw unique 'gender' values: {df['gender'].unique()}")
    gender_map = {
        'male': 'Male', 'm': 'Male', 'man': 'Male',
        'female': 'Female', 'f': 'Female', 'woman': 'Female',
        'other': 'Other', 'non-binary': 'Other', # Group less common/specific ones
    }
    df['gender_std'] = df['gender'].fillna('Unknown').astype(str).str.strip().str.lower()
    df['gender_std'] = df['gender_std'].map(gender_map).fillna('Other')
    # print(f"DEBUG: Mapped unique 'gender_std' values: {df['gender_std'].unique()}")

    # --- Calculations ---
    overall_placement_rate = df['placement_numeric'].mean()
    placed_valid_package = df[(df['placement_numeric'] == 1)]['package_lpa'] # Already dropped NaN package earlier
    overall_avg_package = placed_valid_package.mean() if not placed_valid_package.empty else 0

    # --- CGPA Distribution ---
    cgpa_distribution = {}
    bins = [0, 7, 8, 9, 10.1] # Upper bound slightly > 10 for inclusion
    labels = ['< 7', '7-8', '8-9', '9+']
    try:
        df['cgpa_bin'] = pd.cut(df['cgpa'], bins=bins, labels=labels, right=False, include_lowest=True)
        cgpa_counts = df['cgpa_bin'].value_counts().reindex(labels, fill_value=0)
        cgpa_distribution = cgpa_counts.to_dict()
    except Exception as e:
        print(f"ERROR calculating CGPA distribution: {e}")
        cgpa_distribution = {'error': f'Failed: {str(e)}'}

    # --- Average CGPA by Placement Status ---
    avg_cgpa_by_placement = {}
    try:
        avg_cgpa = df.groupby('placement_numeric')['cgpa'].mean().round(2)
        avg_cgpa_by_placement = {
            'Not Placed': avg_cgpa.get(0), # Returns None if 0 not present
            'Placed': avg_cgpa.get(1)      # Returns None if 1 not present
        }
        # Keep only valid entries
        avg_cgpa_by_placement = {k: v for k, v in avg_cgpa_by_placement.items() if v is not None and not pd.isna(v)}
    except Exception as e:
        print(f"ERROR calculating average CGPA by placement: {e}")
        avg_cgpa_by_placement = {'error': f'Failed: {str(e)}'}

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
        placed_students = df[df['placement_numeric'] == 1].copy() # Use copy to avoid SettingWithCopyWarning
        valid_dept_pkg_df = placed_students[placed_students['department'].notna() & (placed_students['department'] != '')]
        if not valid_dept_pkg_df.empty:
            results['package_by_dept'] = valid_dept_pkg_df.groupby('department')['package_lpa'].mean().round(2).sort_index().to_dict()

        # CGPA vs Package (Placed only)
        valid_scatter_data = placed_students[['cgpa', 'package_lpa']].dropna() # Ensure no NaNs here either
        if not valid_scatter_data.empty:
             results['cgpa_package_data'] = {
                'cgpa': valid_scatter_data['cgpa'].tolist(),
                'package': valid_scatter_data['package_lpa'].tolist()
             }

        # Top Recruiting Companies (Placed only)
        if 'company' in df.columns and total_placed > 0:
            placed_df_co = placed_students[placed_students['company'].notna() & (placed_students['company'].str.strip() != '')]
            if not placed_df_co.empty:
                results['top_companies'] = placed_df_co['company'].str.strip().value_counts().head(10).to_dict()
        else:
            results['top_companies'] = {'error': "'company' column missing or no placements"}


        # Top Skills (Placed only)
        if 'skills' in df.columns and total_placed > 0:
             skills_data = placed_students[placed_students['skills'].notna()]['skills']
             if not skills_data.empty:
                try:
                    all_skills = []
                    # Robust splitting for various delimiters and extra spaces
                    for skills_str in skills_data.astype(str):
                        delimiters = [',', ';', '|', ' '] # Add more if needed
                        # Replace multiple delimiters with a single one (e.g., comma)
                        processed_str = skills_str
                        for d in delimiters[1:]:
                            processed_str = processed_str.replace(d, delimiters[0])
                        # Split and clean
                        split_skills = [s.strip().lower() for s in processed_str.split(delimiters[0]) if s.strip()]
                        all_skills.extend(split_skills)

                    if all_skills:
                        skill_counts = Counter(all_skills)
                        # Filter out generic/short skills if needed (optional)
                        # skill_counts = {k: v for k, v in skill_counts.items() if len(k) > 2}
                        results['top_skills'] = {k: v for k, v in sorted(skill_counts.items(), key=lambda item: item[1], reverse=True)[:10]}
                except Exception as e:
                    print(f"ERROR processing skills: {e}")
                    results['top_skills'] = {'error': f'Skill processing failed: {str(e)}'}
             else:
                 results['top_skills'] = {'error': 'No non-empty skills data for placed students'}
        else:
            results['top_skills'] = {'error': "'skills' column missing or no placements"}


        # Gender Placement Comparison
        if 'gender_std' in df.columns and df['gender_std'].nunique() > 1 and not df['gender_std'].isin(['Unknown', 'Other']).all():
            try:
                # Filter out 'Unknown' and 'Other' before crosstab unless 'Other' has significant counts
                df_gender_filtered = df[~df['gender_std'].isin(['Unknown'])] # Keep 'Other' for now
                if df_gender_filtered['gender_std'].nunique() < 2:
                    print("Warning: Not enough distinct gender values after filtering for comparison.")
                    results['gender_placement'] = {'error': 'Insufficient distinct gender values'}
                else:
                    gender_placement_df = pd.crosstab(df_gender_filtered['gender_std'], df_gender_filtered['placement_numeric'])
                    # Ensure both placement statuses (0 and 1) exist as columns
                    if 0 not in gender_placement_df.columns: gender_placement_df[0] = 0
                    if 1 not in gender_placement_df.columns: gender_placement_df[1] = 0
                    # Convert to dict, ensuring keys are strings
                    temp_dict = gender_placement_df[[0, 1]].astype(int).sort_index().to_dict(orient='index')
                    results['gender_placement'] = {k: {str(k_inner): v_inner for k_inner, v_inner in v.items()} for k, v in temp_dict.items()}
                    # Optional: Filter out 'Other' if it has zero total counts
                    # results['gender_placement'] = {k: v for k, v in results['gender_placement'].items() if k != 'Other' or v.get('0', 0) + v.get('1', 0) > 0}
            except Exception as e:
                print(f"ERROR creating gender placement crosstab: {e}")
                results['gender_placement'] = {'error': f'Gender processing failed: {str(e)}'}
        else:
             if 'gender' not in df.columns: # Error was from missing column
                 pass # Error already captured
             else: # Column exists, but data is insufficient
                 print("Warning: Not enough distinct/valid gender values for comparison chart.")
                 results['gender_placement'] = {'error': 'Insufficient distinct gender values'}

        return results

    except Exception as e:
        print(f"ERROR during placement data calculations: {e}")
        traceback.print_exc()
        results['error'] = f'Partial data; Error in placement calculations: {str(e)}'
        return results


def process_faculty_data(df):
    """Processes faculty review data to generate metrics for the dashboard."""
    if df.empty:
        return {'error': 'Faculty data is empty or could not be loaded.'}

    required_cols = ['review', 'department', 'faculty', 'course_taught'] # Removed semester/student_year as not strictly required for *all* charts
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        # Allow processing if only optional cols are missing, but log warning
        print(f"Warning: Optional faculty column(s) missing: {', '.join(missing_cols)}. Some charts may be unavailable.")
        if 'review' not in df.columns: # Review is critical
             return {'error': f"Missing essential faculty column(s): review"}


    # --- Data Preparation ---
    if 'review' not in df.columns:
         return {'error': "Missing 'review' column"}

    df['rating'] = pd.to_numeric(df['review'], errors='coerce')
    initial_rows = len(df)
    df.dropna(subset=['rating'], inplace=True)
    if len(df) < initial_rows:
        print(f"Info: Dropped {initial_rows - len(df)} faculty rows due to non-numeric 'review'.")

    rating_min, rating_max = 1, 5 # Assumed scale
    # Allow floats for average, but round for distribution
    df['rating_int'] = df['rating'].round().astype(int)
    df_valid_scale = df[df['rating_int'].between(rating_min, rating_max)].copy() # Keep only valid integer ratings
    if df_valid_scale.empty:
         return {'error': f'No valid faculty ratings found in the range ({rating_min}-{rating_max}) after cleaning.'}


    # --- Calculations ---
    overall_avg_rating = df_valid_scale['rating'].mean() # Use original float rating for avg

    # *** Calculate Rating Distribution ***
    rating_distribution = {}
    try:
        # Count occurrences of each integer rating (1, 2, 3, 4, 5)
        rating_counts = df_valid_scale['rating_int'].value_counts()
        # Ensure all possible ratings (1-5) are present in the dict, even if count is 0
        for i in range(rating_min, rating_max + 1):
            rating_distribution[str(i)] = int(rating_counts.get(i, 0)) # Keys as strings for JS/JSON
        # Sort by rating value key
        rating_distribution = dict(sorted(rating_distribution.items(), key=lambda item: int(item[0])))
    except Exception as e:
        print(f"ERROR calculating rating distribution: {e}")
        rating_distribution = {'error': f'Failed: {str(e)}'}


    results = {
        'kpi_overall_avg_rating': round(overall_avg_rating, 2) if not pd.isna(overall_avg_rating) else None,
        'dept_teaching_ratings': {},
        'semester_ratings': {},
        'yearly_average_trend': {},
        'top_faculty': {},
        'course_ratings': {},
        'rating_distribution': rating_distribution,
    }

    try:
        # Department Teaching Ratings
        if 'department' in df_valid_scale.columns:
            valid_dept_df = df_valid_scale[df_valid_scale['department'].notna() & (df_valid_scale['department'] != '')]
            if not valid_dept_df.empty:
                 results['dept_teaching_ratings'] = valid_dept_df.groupby('department')['rating'].mean().round(2).sort_index().to_dict()
            else: results['dept_teaching_ratings'] = {'error': 'No valid department data'}
        else: results['dept_teaching_ratings'] = {'error': "'department' column missing"}

        # Semester Rating Comparison
        if 'semester' in df_valid_scale.columns:
             valid_sem_df = df_valid_scale[df_valid_scale['semester'].notna()]
             if not valid_sem_df.empty:
                 try:
                     # Attempt numeric sort first
                     semester_means = valid_sem_df.groupby('semester')['rating'].mean().round(2)
                     numeric_index = pd.to_numeric(semester_means.index.astype(str).str.extract(r'(\d+)$', expand=False), errors='coerce')
                     if not numeric_index.isna().all(): # If at least one is numeric
                         results['semester_ratings'] = semester_means.sort_index(key=lambda x: pd.to_numeric(x.astype(str).str.extract(r'(\d+)$', expand=False), errors='coerce').fillna(float('inf'))).to_dict()
                     else: # Fallback to string sort
                         results['semester_ratings'] = semester_means.sort_index().to_dict()
                 except Exception as e: # Fallback to basic string sort on error
                     print(f"Warning: Semester sorting failed ({e}), using basic sort.")
                     results['semester_ratings'] = valid_sem_df.groupby(df_valid_scale['semester'].astype(str))['rating'].mean().round(2).sort_index().to_dict()
             else: results['semester_ratings'] = {'error': 'No valid semester data'}
        else: results['semester_ratings'] = {'error': "'semester' column missing"}


        # Overall Faculty Rating Trend (Yearly using student_year)
        if 'student_year' in df_valid_scale.columns:
            valid_year_df = df_valid_scale[df_valid_scale['student_year'].notna()].copy() # Use .copy()
            if not valid_year_df.empty:
               try:
                   # Attempt numeric interpretation and sort
                   valid_year_df['year_num'] = pd.to_numeric(valid_year_df['student_year'], errors='coerce')
                   valid_year_df_num = valid_year_df.dropna(subset=['year_num'])
                   if not valid_year_df_num.empty:
                       yearly_trend = valid_year_df_num.groupby('year_num')['rating'].mean().round(2).sort_index()
                       results['yearly_average_trend'] = {str(int(k)): v for k, v in yearly_trend.to_dict().items()} # Keys as strings
                   else: # If no numeric years found, try string sort
                       print("Warning: Could not interpret 'student_year' as numeric, using string sort.")
                       yearly_trend = valid_year_df.groupby(valid_year_df['student_year'].astype(str))['rating'].mean().round(2).sort_index()
                       results['yearly_average_trend'] = yearly_trend.to_dict()

               except Exception as e: # Fallback to string sort on any error
                    print(f"Warning: Yearly trend calculation failed ({e}), using basic string sort.")
                    yearly_trend = valid_year_df.groupby(valid_year_df['student_year'].astype(str))['rating'].mean().round(2).sort_index()
                    results['yearly_average_trend'] = yearly_trend.to_dict()
            else: results['yearly_average_trend'] = {'error': 'No valid student_year data'}
        else: results['yearly_average_trend'] = {'error': "'student_year' column missing"}


        # Top Rated Faculty
        if 'faculty' in df_valid_scale.columns:
            valid_fac_df = df_valid_scale[df_valid_scale['faculty'].notna() & (df_valid_scale['faculty'] != '')]
            if not valid_fac_df.empty:
                 results['top_faculty'] = valid_fac_df.groupby('faculty')['rating'].mean().nlargest(5).round(2).to_dict()
            else: results['top_faculty'] = {'error': 'No valid faculty data'}
        else: results['top_faculty'] = {'error': "'faculty' column missing"}

        # Top Rated Courses
        if 'course_taught' in df_valid_scale.columns:
            valid_course_df = df_valid_scale[df_valid_scale['course_taught'].notna() & (df_valid_scale['course_taught'] != '')]
            if not valid_course_df.empty:
                results['course_ratings'] = valid_course_df.groupby('course_taught')['rating'].mean().nlargest(5).round(2).to_dict()
            else: results['course_ratings'] = {'error': 'No valid course_taught data'}
        else: results['course_ratings'] = {'error': "'course_taught' column missing"}

        return results

    except Exception as e:
        print(f"ERROR processing faculty data calculations: {e}")
        traceback.print_exc()
        results['error'] = f'Partial data; Error in faculty calculations: {str(e)}'
        # Make sure distribution is still returned if calculated before error
        if 'rating_distribution' not in results:
            results['rating_distribution'] = rating_distribution # Ensure it's added even on error
        return results

# --- Prompt Creation Functions ---

def create_exam_summary_prompt(data):
    """Creates a tailored prompt for Gemini based on exam data."""
    # Safely extract data using .get()
    avg_mark = data.get('kpi_overall_avg_mark', 'N/A')
    grades = data.get('grade_distribution', {})
    most_common_grade = max(grades, key=grades.get) if grades and not grades.get('error') else 'N/A'
    dept_perf = data.get('performance_by_department', {})
    top_dept = max(dept_perf, key=dept_perf.get) if dept_perf and not dept_perf.get('error') else 'N/A'
    top_dept_score = dept_perf.get(top_dept, 'N/A') if top_dept != 'N/A' else 'N/A'
    bottom_dept = min(dept_perf, key=dept_perf.get) if dept_perf and not dept_perf.get('error') else 'N/A'
    bottom_dept_score = dept_perf.get(bottom_dept, 'N/A') if bottom_dept != 'N/A' else 'N/A'
    top_subjects = list(data.get('subject_performance', {}).keys())[:3] # Top 3 subjects
    internal_avg = data.get('marks_comparison', {}).get('Internal', 'N/A')
    external_avg = data.get('marks_comparison', {}).get('External', 'N/A')
    trend = data.get('semester_performance', {}) # Yearly trend data

    prompt = f"""
    You are an academic data analyst providing a concise summary for a university dashboard.
    Based ONLY on the following Academic Performance data, generate a 2-4 bullet point summary highlighting key insights.
    Focus on overall performance, departmental variations, and notable subject/exam type differences.
    Do NOT invent data or make assumptions beyond what's provided. Format the output as bullet points.

    Key Data Points:
    - Overall Average Mark: {avg_mark}
    - Most Common Grade: {most_common_grade} (Distribution: {grades})
    - Top Performing Department (Avg Mark): {top_dept} ({top_dept_score})
    - Lowest Performing Department (Avg Mark): {bottom_dept} ({bottom_dept_score})
    - Sample Top Subjects (Avg Mark): {', '.join(top_subjects) if top_subjects else 'N/A'}
    - Average Internal Mark: {internal_avg}
    - Average External Mark: {external_avg}
    - Yearly Trend (Avg Marks): {trend if trend and not trend.get('error') else 'N/A'}

    Generate the summary now:
    """
    return prompt

def create_placement_summary_prompt(data):
    """Creates a tailored prompt for Gemini based on placement data."""
    # Safely extract data using .get()
    rate = data.get('kpi_overall_placement_rate', 'N/A')
    avg_pkg = data.get('kpi_overall_avg_package', 'N/A')
    dept_rate = data.get('placement_rate_by_dept', {})
    top_dept_rate = max(dept_rate, key=dept_rate.get) if dept_rate and not dept_rate.get('error') else 'N/A'
    top_dept_rate_val = f"{dept_rate.get(top_dept_rate, 0)*100:.1f}%" if top_dept_rate != 'N/A' else 'N/A'
    dept_pkg = data.get('package_by_dept', {})
    top_dept_pkg = max(dept_pkg, key=dept_pkg.get) if dept_pkg and not dept_pkg.get('error') else 'N/A'
    top_dept_pkg_val = dept_pkg.get(top_dept_pkg, 'N/A') if top_dept_pkg != 'N/A' else 'N/A'
    top_companies = list(data.get('top_companies', {}).keys())[:3]
    top_skills = list(data.get('top_skills', {}).keys())[:3]
    avg_cgpa_placed = data.get('avg_cgpa_by_placement', {}).get('Placed', 'N/A')
    avg_cgpa_unplaced = data.get('avg_cgpa_by_placement', {}).get('Not Placed', 'N/A')
    cgpa_dist = data.get('cgpa_distribution', {})

    prompt = f"""
    You are a placement data analyst providing a concise summary for a university dashboard.
    Based ONLY on the following Placement Statistics, generate a 2-4 bullet point summary highlighting key insights.
    Focus on overall rates/packages, departmental differences, top recruiters/skills, and CGPA correlations.
    Do NOT invent data or make assumptions beyond what's provided. Format the output as bullet points.

    Key Data Points:
    - Overall Placement Rate: {rate}
    - Overall Average Package (LPA): {avg_pkg}
    - Department with Highest Placement Rate: {top_dept_rate} ({top_dept_rate_val})
    - Department with Highest Average Package (LPA): {top_dept_pkg} ({top_dept_pkg_val})
    - Sample Top Recruiting Companies: {', '.join(top_companies) if top_companies else 'N/A'}
    - Sample Top In-Demand Skills: {', '.join(top_skills) if top_skills else 'N/A'}
    - Average CGPA (Placed): {avg_cgpa_placed}
    - Average CGPA (Not Placed): {avg_cgpa_unplaced}
    - CGPA Distribution (Count): {cgpa_dist if cgpa_dist and not cgpa_dist.get('error') else 'N/A'}

    Generate the summary now:
    """
    return prompt

def create_faculty_summary_prompt(data):
    """Creates a tailored prompt for Gemini based on faculty evaluation data."""
     # Safely extract data using .get()
    avg_rating = data.get('kpi_overall_avg_rating', 'N/A')
    rating_dist = data.get('rating_distribution', {})
    most_common_rating = max(rating_dist, key=rating_dist.get) if rating_dist and not rating_dist.get('error') else 'N/A'
    dept_ratings = data.get('dept_teaching_ratings', {})
    top_dept = max(dept_ratings, key=dept_ratings.get) if dept_ratings and not dept_ratings.get('error') else 'N/A'
    top_dept_score = dept_ratings.get(top_dept, 'N/A') if top_dept != 'N/A' else 'N/A'
    bottom_dept = min(dept_ratings, key=dept_ratings.get) if dept_ratings and not dept_ratings.get('error') else 'N/A'
    bottom_dept_score = dept_ratings.get(bottom_dept, 'N/A') if bottom_dept != 'N/A' else 'N/A'
    top_faculty = list(data.get('top_faculty', {}).keys())[:3]
    top_courses = list(data.get('course_ratings', {}).keys())[:3]
    trend = data.get('yearly_average_trend', {})

    prompt = f"""
    You are a data analyst summarizing faculty evaluations for a university dashboard.
    Based ONLY on the following Faculty Evaluation data, generate a 2-4 bullet point summary highlighting key insights.
    Focus on overall ratings, distribution, departmental variations, and top performers (faculty/courses).
    Do NOT invent data or make assumptions beyond what's provided. Format the output as bullet points.

    Key Data Points:
    - Overall Average Faculty Rating (1-5): {avg_rating}
    - Most Common Rating Given: {most_common_rating} (Distribution: {rating_dist if rating_dist and not rating_dist.get('error') else 'N/A'})
    - Top Rated Department (Avg Rating): {top_dept} ({top_dept_score})
    - Lowest Rated Department (Avg Rating): {bottom_dept} ({bottom_dept_score})
    - Sample Top Rated Faculty: {', '.join(top_faculty) if top_faculty else 'N/A'}
    - Sample Top Rated Courses: {', '.join(top_courses) if top_courses else 'N/A'}
    - Yearly Rating Trend (Avg Rating): {trend if trend and not trend.get('error') else 'N/A'}

    Generate the summary now:
    """
    return prompt


# --- Main Execution ---
if __name__ == '__main__':
    # Set debug=False for production deployment
    # Use threaded=True for potentially better handling of concurrent requests including API calls
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)