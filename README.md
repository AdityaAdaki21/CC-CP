# Student Performance Dashboard

A comprehensive Flask-based web application that visualizes student performance data stored in an AWS S3 bucket. The dashboard provides insights into academic performance, placement statistics, and faculty evaluations through interactive charts and visualizations.

## Features

### Academic Performance Tab
- Grade distribution visualization (A+ to F)
- Internal vs External marks comparison
- Semester-wise performance trends
- Department-wise average marks analysis
- Top performing subjects overview

### Placement Statistics Tab
- Department-wise placement rates
- Average package (LPA) by department
- Gender-based placement distribution
- CGPA vs Package correlation analysis
- Top recruiting companies visualization
- Most in-demand skills analysis

### Faculty Evaluations Tab
- Average ratings by teaching categories
- Department teaching performance ratings
- Semester-wise rating comparisons
- Faculty rating trends (yearly)
- Top rated faculty members
- Highest rated courses

## Data Structure

### Exam Data (exam_data.csv)
```
Columns:
- prn: Student ID
- subjects: Course subjects
- marks: Examination scores
- date: Exam date
- department: Student's department
- exam_type: Internal/External
```

### Placement Data (placement_data.csv)
```
Columns:
- year: Academic year
- placement: Placement status (Yes/No)
- department: Student's department
- internship: Internship status
- prn: Student ID
- cgpa: Cumulative Grade Point Average
- company: Recruiting company name
- package_lpa: Package in Lakhs Per Annum
- skills: Required/Matched skills
- gender: Student's gender
```

### Faculty Reviews Data (faculty_reviews.csv)
```
Columns:
- faculty: Faculty member name
- review: Numerical rating
- department: Faculty's department
- course_taught: Course name
- experience_years: Teaching experience
- qualification: Educational qualification
- feedback_text: Student feedback
- semester: Academic semester
- student_year: Student's year
- feedback_date: Date of review
```

## Technology Stack

### Frontend
- HTML5
- CSS3 (Responsive design)
- JavaScript
- Chart.js (v3.9.1) for data visualization
- Responsive and interactive UI with tab navigation

### Backend
- Python 3.11+
- Flask web framework
- Pandas for data processing
- Boto3 for AWS S3 integration
- Python-dotenv for environment management

### Cloud Infrastructure
- AWS S3 for data storage
- Data files stored in 'student-performance-dashboard' bucket

## Project Structure

```
student-performance-dashboard/
├── app.py                  # Flask application & data processing
├── .env                    # Environment variables (AWS credentials)
├── requirements.txt        # Python dependencies
├── static/
│   ├── css/
│   │   └── styles.css     # Dashboard styling
│   └── js/
│       └── dashboard.js    # Chart initialization & data handling
└── templates/
    └── index.html         # Dashboard HTML template
```

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd student-performance-dashboard
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure AWS credentials:
   Create a `.env` file in the project root:
   ```
   AWS_ACCESS_KEY_ID=your_access_key_id
   AWS_SECRET_ACCESS_KEY=your_secret_access_key
   AWS_REGION=us-east-1
   ```

5. Ensure S3 bucket structure:
   - Bucket name: student-performance-dashboard
   - Required files:
     - data/exam_data.csv
     - data/placement_data.csv
     - data/faculty_reviews.csv

6. Run the application:
   ```bash
   python app.py
   ```

7. Access the dashboard:
   Open your browser and navigate to `http://127.0.0.1:5000/`

## Development Notes

### Chart Types Used
- Pie Chart: Grade distribution
- Bar Charts: Department performance, placement rates
- Line Charts: Semester trends, rating trends
- Radar Chart: Faculty rating categories
- Scatter Plot: CGPA vs Package correlation
- Stacked Bar: Gender placement comparison
- Horizontal Bar: Top companies, skills

### Error Handling
- Comprehensive error handling for S3 data fetching
- Graceful degradation with error messages
- Data validation and cleaning
- Missing data handling

### Performance Optimization
- Efficient data processing with Pandas
- Client-side chart rendering
- Responsive design for all screen sizes
- Optimized chart.js configurations

### Security
- Environment-based AWS credentials
- No sensitive data exposure
- Secure S3 bucket configuration required

## AWS S3 Setup Requirements

1. Create an S3 bucket named 'student-performance-dashboard'
2. Configure bucket permissions:
   - Enable appropriate CORS settings
   - Set up IAM user with necessary permissions
3. Upload data files with correct schema:
   - data/exam_data.csv
   - data/placement_data.csv
   - data/faculty_reviews.csv

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT

## Author

[Your Name]

## Acknowledgments

- Chart.js community
- Flask documentation
- AWS S3 documentation