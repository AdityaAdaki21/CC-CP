// static/js/dashboard.js

// Chart.js defaults (keep as is)
Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#6c757d'; // Use a slightly muted gray
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 0.85)';
Chart.defaults.plugins.tooltip.titleFont = { weight: 'bold', size: 14 };
Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 5;
Chart.defaults.plugins.tooltip.displayColors = false; // cleaner tooltip without color box

// --- UI Elements ---
const loadingIndicator = document.getElementById('loading-indicator');
const dashboardElement = document.querySelector('.dashboard');
const headerElement = document.querySelector('.header');

// --- NEW: AI Query Elements ---
const aiQueryInput = document.getElementById('ai-query-input');
const aiQuerySubmit = document.getElementById('ai-query-submit');
const aiQueryResponse = document.getElementById('ai-query-response');
const aiQueryStatus = document.getElementById('ai-query-status');
const aiQueryStatusText = aiQueryStatus?.querySelector('.status-text');

// --- Data Fetching and Error Handling (keep as is) ---
async function fetchDashboardData() {
    showLoading();
    try {
        const response = await fetch('/api/data');
        if (!response.ok) {
            let errorBody = `Server responded with ${response.status} ${response.statusText}`;
            try {
                const errorJson = await response.json();
                // Use detailed error from backend if available
                errorBody = errorJson.error || errorJson.message || JSON.stringify(errorJson);
            } catch (e) { /* Ignore if body isn't JSON */ }
            throw new Error(errorBody);
        }
        const data = await response.json();
        console.log("API Data Received (with summaries):", JSON.parse(JSON.stringify(data))); // Deep copy log
        // Check for errors in main sections or summary generation
        if (data.exam_data?.error || data.placement_data?.error || data.faculty_data?.error ||
            data.exam_data?.gemini_summary_error || data.placement_data?.gemini_summary_error || data.faculty_data?.gemini_summary_error) {
             console.warn("Data fetched but contains errors in sections or summaries:", data);
        }
        hideLoading();
        return data;
    } catch (error) {
        console.error('Fatal Error fetching dashboard data:', error);
        displayGlobalErrorMessage(`Could not load dashboard: ${error.message}. Check network or backend logs.`);
        hideLoading();
        return null;
    }
}

function showLoading() {
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    if (dashboardElement) dashboardElement.classList.add('loading');
}

function hideLoading() {
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
     if (dashboardElement) dashboardElement.classList.remove('loading');
}

function displayGlobalErrorMessage(message) {
    if (!headerElement) return;
    let errorDiv = headerElement.querySelector('.global-error');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'global-error';
        // Insert after the header's H1/P but before tab navigation
        const refElement = headerElement.querySelector('.tab-navigation') || headerElement.lastElementChild;
        headerElement.insertBefore(errorDiv, refElement);
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function clearGlobalErrorMessage() {
     const errorDiv = headerElement?.querySelector('.global-error');
     if (errorDiv) errorDiv.style.display = 'none';
}

function displayErrorOnChart(canvasId, message = 'Error loading chart data') {
    const canvas = document.getElementById(canvasId);
    const chartContainer = canvas ? canvas.closest('.chart-container') : null;
    if (!canvas || !chartContainer) {
        console.warn(`Canvas or container not found for ID: ${canvasId}`);
        return;
    }

    // Destroy existing chart instance
    let chartInstance = Chart.getChart(canvasId);
    if (chartInstance) chartInstance.destroy();

    // Create or reuse error message div within the container
    let errorMsgElement = chartContainer.querySelector('.chart-error-message');
    if (!errorMsgElement) {
        errorMsgElement = document.createElement('div');
        errorMsgElement.className = 'chart-error-message';
        // Style is now mostly in CSS, just control display here
        chartContainer.appendChild(errorMsgElement);
    }

    // Hide the canvas, show the error message
    canvas.style.display = 'none';
    errorMsgElement.textContent = message;
    errorMsgElement.style.display = 'flex'; // Use flex as defined in CSS
}

function clearErrorOnChart(canvasId) {
     const canvas = document.getElementById(canvasId);
     const chartContainer = canvas ? canvas.closest('.chart-container') : null;
     if (!chartContainer) return;

     const errorMsgElement = chartContainer.querySelector('.chart-error-message');
     if (errorMsgElement) errorMsgElement.style.display = 'none'; // Hide the error
     if (canvas) canvas.style.display = 'block'; // Show the canvas
}


// --- Initialization Functions (keep updateKPI, updateComparisonNote as is) ---
function updateKPI(elementId, value, unit = '', notAvailableText = 'N/A') {
    const element = document.getElementById(elementId);
     if (element) {
        // Check for null, undefined, or empty string. Allows 0.
        if (value !== null && typeof value !== 'undefined' && value !== '') {
            element.textContent = `${value}${unit}`; // Unit is appended only if value exists
        } else {
            element.textContent = notAvailableText;
        }
    }
}

function updateComparisonNote(elementId, value, unit = '', prefix = 'Overall Avg: ') {
    const element = document.getElementById(elementId);
     if (element) {
        // Check if value is a valid number or a non-empty string (like "75.5%")
        const isValidNumber = typeof value === 'number' && !isNaN(value);
        const isValidString = typeof value === 'string' && value.trim() !== '';

         if (isValidNumber || isValidString) {
             element.textContent = `(${prefix}${value}${unit})`;
             element.style.display = 'inline'; // Show note
         } else {
             element.style.display = 'none'; // Hide note
         }
     }
}

// --- Helper function to display AI summary or error ---
function updateSummaryDisplay(summaryId, errorId, summaryText, errorText) {
    const summaryElement = document.getElementById(summaryId);
    const errorElement = document.getElementById(errorId);

    if (!summaryElement || !errorElement) {
        console.warn(`Summary display elements not found for IDs: ${summaryId}, ${errorId}`);
        return;
    }

    // Clear previous state
    summaryElement.textContent = '';
    summaryElement.style.display = 'none';
    errorElement.textContent = '';
    errorElement.style.display = 'none';

    if (errorText) {
        errorElement.textContent = `Summary Error: ${errorText}`;
        errorElement.style.display = 'block';
    } else if (summaryText) {
        // Sanitize potentially unsafe HTML? Basic textContent is safer.
        // Use innerHTML if markdown/bolding is expected and trusted.
        summaryElement.innerHTML = summaryText.replace(/\n/g, '<br>'); // Basic newline handling
        summaryElement.style.display = 'block';
    } else {
        // Neither summary nor error text provided (maybe API disabled or unexpected state)
        errorElement.textContent = 'Summary not available.';
        errorElement.style.display = 'block';
    }
}

// --- Section Initializers (initializeExamCharts, initializePlacementCharts, initializeFacultyCharts - keep as is) ---
// No changes needed in the chart initialization logic itself for this feature.
// --- Paste your existing initializeExamCharts, initializePlacementCharts, initializeFacultyCharts functions here ---
function initializeExamCharts(examData) {
    // --- Display AI Summary FIRST ---
    updateSummaryDisplay(
        'exam-summary',
        'exam-summary-error',
        examData?.gemini_summary,
        examData?.gemini_summary_error
    );

    // --- KPIs & Global Error Handling ---
    if (!examData || examData.error) {
        const errorMsg = examData?.error || "Exam data unavailable";
        console.error("Exam data error:", errorMsg);
        // Display errors on all canvases for this section
        const chartIds = ['gradeChart', 'departmentPerformanceChart', 'topSubjectsChart', 'marksComparisonChart', 'semesterChart'];
        chartIds.forEach(id => displayErrorOnChart(id, errorMsg));
        // Update KPIs to show error/NA
        updateKPI('kpi-avg-mark', null, '', 'Error');
        updateKPI('kpi-grade-overview', null, '', 'Error');
        updateKPI('kpi-pass-rate', null, '', 'Error'); // <-- NEW: Update pass rate KPI on error
        updateComparisonNote('dept-perf-comparison-note', null); // Clear note
        return; // Don't proceed if main data failed
    }

    // --- Clear Previous Errors ---
    const chartIds = ['gradeChart', 'departmentPerformanceChart', 'topSubjectsChart', 'marksComparisonChart', 'semesterChart'];
    chartIds.forEach(clearErrorOnChart);


    // --- Update KPIs ---
    updateKPI('kpi-avg-mark', examData.kpi_overall_avg_mark);

    let overallPassRate = null; // Initialize pass rate

    // Check if grade_distribution exists, is an object, and doesn't have an error key
    if (examData.grade_distribution && typeof examData.grade_distribution === 'object' && !examData.grade_distribution.error && Object.keys(examData.grade_distribution).length > 0) {
        const gradeCounts = examData.grade_distribution;
        const totalStudents = Object.values(gradeCounts).reduce((sum, count) => sum + count, 0);
        const failCount = gradeCounts['F'] || 0; // Get count for 'F' grade, default to 0

        if (totalStudents > 0) {
            const passCount = totalStudents - failCount;
            overallPassRate = (passCount / totalStudents) * 100; // Calculate percentage

            // Update Grade Overview KPI (only if calculation was possible)
            const validGrades = Object.entries(gradeCounts).filter(([grade, count]) => count > 0);
            if (validGrades.length > 0) {
                const mostCommonGrade = validGrades.sort(([, countA], [, countB]) => countB - countA)[0]?.[0];
                updateKPI('kpi-grade-overview', mostCommonGrade || 'N/A', '', 'N/A');
            } else {
                 updateKPI('kpi-grade-overview', null);
            }
        } else {
            // No students with grades found
             updateKPI('kpi-grade-overview', null); // No overview if no students
        }
    } else {
         // Grade distribution data missing or has error
         updateKPI('kpi-grade-overview', null); // Use default 'N/A'
    }

    // --- NEW: Update Pass Rate KPI ---
    // Use the calculated overallPassRate. updateKPI handles null/undefined.
    updateKPI('kpi-pass-rate', overallPassRate !== null ? overallPassRate.toFixed(1) : null, '%'); // Format to 1 decimal place

    // --- Create Charts (Rest of the function remains the same) ---

    // Grade Distribution (Pie)
    if (examData.grade_distribution && typeof examData.grade_distribution === 'object' && !examData.grade_distribution.error && Object.values(examData.grade_distribution).some(v => v > 0)) {
        createPieChart('gradeChart', examData.grade_distribution);
    } else {
        // Display error only if grade data was expected but faulty/missing
        // Don't display error if the pass rate was calculated but simply 0% or 100%
        if (!examData.grade_distribution || examData.grade_distribution.error) {
             displayErrorOnChart('gradeChart', examData.grade_distribution?.error || 'No Grade Distribution data found');
        } else if (!Object.values(examData.grade_distribution).some(v => v > 0)){
             displayErrorOnChart('gradeChart', 'No student grades recorded');
        }
    }

    // Department Performance (Bar)
    const overallAvgMark = examData.kpi_overall_avg_mark;
    if (examData.performance_by_department && typeof examData.performance_by_department === 'object' && !examData.performance_by_department.error && Object.keys(examData.performance_by_department).length > 0) {
        createBarChart('departmentPerformanceChart', examData.performance_by_department, 'Avg Mark', 100); // Scale 0-100
        updateComparisonNote('dept-perf-comparison-note', overallAvgMark);
    } else {
         displayErrorOnChart('departmentPerformanceChart', examData.performance_by_department?.error || 'No Department Performance data found');
          updateComparisonNote('dept-perf-comparison-note', null);
    }

    // Top Performing Subjects (Horizontal Bar)
    if (examData.subject_performance && typeof examData.subject_performance === 'object' && !examData.subject_performance.error && Object.keys(examData.subject_performance).length > 0) {
        createHorizontalBarChart('topSubjectsChart', examData.subject_performance, 'Avg Mark', 100); // Scale 0-100
    } else {
        displayErrorOnChart('topSubjectsChart', examData.subject_performance?.error ||'No Top Subject Performance data found');
    }

    // Internal vs External Marks Comparison (Bar)
    const comparisonData = {};
    let hasComparisonData = false;
    if (examData.marks_comparison && typeof examData.marks_comparison === 'object') {
         if (examData.marks_comparison.Internal !== null && typeof examData.marks_comparison.Internal === 'number') {
             comparisonData.Internal = examData.marks_comparison.Internal;
             hasComparisonData = true;
         }
          if (examData.marks_comparison.External !== null && typeof examData.marks_comparison.External === 'number') {
             comparisonData.External = examData.marks_comparison.External;
             hasComparisonData = true;
         }
    }
    if (hasComparisonData) {
         createMarksComparisonChart('marksComparisonChart', comparisonData);
    } else {
         displayErrorOnChart('marksComparisonChart', 'Internal/External mark data unavailable or invalid');
    }

    // Yearly Performance Trend (Line)
    if (examData.semester_performance && typeof examData.semester_performance === 'object' && !examData.semester_performance.error && Object.keys(examData.semester_performance).length > 1) { // Need > 1 point for a trend
        createTrendChart('semesterChart', examData.semester_performance, 'Avg Marks');
    } else if (examData.semester_performance && typeof examData.semester_performance === 'object' && !examData.semester_performance.error && Object.keys(examData.semester_performance).length === 1){
       displayErrorOnChart('semesterChart', 'Only one data point found for yearly trend');
    } else {
       displayErrorOnChart('semesterChart', examData.semester_performance?.error || 'No Yearly Performance Trend data found');
    }
} // End of initializeExamCharts

function initializePlacementCharts(placementData) {
    // --- Display AI Summary FIRST ---
     updateSummaryDisplay(
        'placement-summary',
        'placement-summary-error',
        placementData?.gemini_summary,
        placementData?.gemini_summary_error
    );

    // --- KPIs & Global Error Handling ---
    if (!placementData || placementData.error) {
        const errorMsg = placementData?.error || "Placement data unavailable";
        console.error("Placement data error:", errorMsg);
        // Display errors on all relevant charts
        const chartIds = ['placementRateChart', 'packageChart', 'genderPlacementChart',
                          'cgpaPackageChart', 'companiesChart', 'skillsChart',
                          'cgpaDistributionChart', 'cgpaPlacedVsUnplacedChart'];
        chartIds.forEach(id => displayErrorOnChart(id, errorMsg));
        // Update KPIs
        updateKPI('kpi-placement-rate', null, '', 'Error');
        updateKPI('kpi-avg-package', null, ' LPA', 'Error');
        updateComparisonNote('placement-rate-comparison-note', null);
        updateComparisonNote('package-dept-comparison-note', null);
        return; // Don't proceed if main data failed
    }

    // --- Clear Previous Errors ---
    const chartIds = ['placementRateChart', 'packageChart', 'genderPlacementChart',
                      'cgpaPackageChart', 'companiesChart', 'skillsChart',
                      'cgpaDistributionChart', 'cgpaPlacedVsUnplacedChart'];
    chartIds.forEach(clearErrorOnChart);

    // --- Update KPIs ---
    updateKPI('kpi-placement-rate', placementData.kpi_overall_placement_rate); // Already formatted string % or null
    updateKPI('kpi-avg-package', placementData.kpi_overall_avg_package, ' LPA');


    // --- Create Charts ---

    // Placement Rate by Department (Bar, Percentage)
    const overallPlacementRate = placementData.kpi_overall_placement_rate; // String e.g., "75.5%"
    if (placementData.placement_rate_by_dept && typeof placementData.placement_rate_by_dept === 'object' && !placementData.placement_rate_by_dept.error && Object.keys(placementData.placement_rate_by_dept).length > 0) {
        createBarChart('placementRateChart', placementData.placement_rate_by_dept, 'Placement Rate', 1, true); // percent = true
        updateComparisonNote('placement-rate-comparison-note', overallPlacementRate, '', 'Overall: ');
    } else {
        displayErrorOnChart('placementRateChart', placementData.placement_rate_by_dept?.error || 'No Department Placement Rate data found');
         updateComparisonNote('placement-rate-comparison-note', null);
    }

    // Average Package by Department (Bar)
    const overallAvgPackage = placementData.kpi_overall_avg_package;
    if (placementData.package_by_dept && typeof placementData.package_by_dept === 'object' && !placementData.package_by_dept.error && Object.keys(placementData.package_by_dept).length > 0) {
        createBarChart('packageChart', placementData.package_by_dept, 'Avg Package (LPA)', null);
        updateComparisonNote('package-dept-comparison-note', overallAvgPackage, ' LPA', 'Overall Avg: ');
    } else {
         displayErrorOnChart('packageChart', placementData.package_by_dept?.error || 'No Avg Package by Department data found');
          updateComparisonNote('package-dept-comparison-note', null);
    }

    // Gender Placement Comparison (Stacked Bar)
    if (placementData.gender_placement && typeof placementData.gender_placement === 'object' && Object.keys(placementData.gender_placement).length > 0 && !placementData.gender_placement.error) {
        // Check if there are actual counts > 0 before creating chart
        const hasCounts = Object.values(placementData.gender_placement).some(counts =>
            (parseInt(counts['0'] || 0) + parseInt(counts['1'] || 0)) > 0
        );
        if (hasCounts) {
            createStackedBarChart('genderPlacementChart', placementData.gender_placement);
        } else {
             displayErrorOnChart('genderPlacementChart', 'No counts found for Gender Placement');
        }
    } else {
        displayErrorOnChart('genderPlacementChart', placementData.gender_placement?.error || 'Gender Placement data unavailable');
    }

    // CGPA Distribution (Bar)
    if (placementData.cgpa_distribution && typeof placementData.cgpa_distribution === 'object' && !placementData.cgpa_distribution.error && Object.keys(placementData.cgpa_distribution).length > 0) {
        createBarChart('cgpaDistributionChart', placementData.cgpa_distribution, 'No. of Students', null);
    } else {
        displayErrorOnChart('cgpaDistributionChart', placementData.cgpa_distribution?.error || 'CGPA Distribution data unavailable');
    }

    // Avg CGPA Placed vs. Not Placed (Bar)
    if (placementData.avg_cgpa_by_placement && typeof placementData.avg_cgpa_by_placement === 'object' && !placementData.avg_cgpa_by_placement.error && Object.keys(placementData.avg_cgpa_by_placement).length > 0) {
         createBarChart('cgpaPlacedVsUnplacedChart', placementData.avg_cgpa_by_placement, 'Average CGPA', 10); // Max CGPA 10
    } else {
         displayErrorOnChart('cgpaPlacedVsUnplacedChart', placementData.avg_cgpa_by_placement?.error || 'Avg CGPA comparison unavailable');
    }

    // CGPA vs Package (Scatter)
    // Ensure cgpa_package_data exists and has the expected structure before accessing .cgpa
    if (placementData.cgpa_package_data && typeof placementData.cgpa_package_data === 'object' && Array.isArray(placementData.cgpa_package_data.cgpa) && placementData.cgpa_package_data.cgpa.length > 0) {
        createScatterPlot('cgpaPackageChart', placementData.cgpa_package_data);
    } else {
        displayErrorOnChart('cgpaPackageChart', placementData.cgpa_package_data?.error || 'Insufficient data for CGPA vs Package plot');
    }


    // Top Recruiting Companies (Horizontal Bar) - Display top 10
    if (placementData.top_companies && typeof placementData.top_companies === 'object' && !placementData.top_companies.error && Object.keys(placementData.top_companies).length > 0) {
        const top10Companies = Object.fromEntries(Object.entries(placementData.top_companies).slice(0, 10));
        createHorizontalBarChart('companiesChart', top10Companies, 'No. of Placements');
    } else {
         displayErrorOnChart('companiesChart', placementData.top_companies?.error || 'Top Companies data unavailable');
    }

    // Most In-Demand Skills (Horizontal Bar) - Display top 10
    if (placementData.top_skills && typeof placementData.top_skills === 'object' && !placementData.top_skills.error && Object.keys(placementData.top_skills).length > 0) {
        const top10Skills = Object.fromEntries(Object.entries(placementData.top_skills).slice(0, 10));
        createHorizontalBarChart('skillsChart', top10Skills, 'Frequency');
    } else {
        displayErrorOnChart('skillsChart', placementData.top_skills?.error || 'Top Skills data unavailable');
    }
}

function initializeFacultyCharts(facultyData) {
    // --- Display AI Summary FIRST ---
    updateSummaryDisplay(
        'faculty-summary',
        'faculty-summary-error',
        facultyData?.gemini_summary,
        facultyData?.gemini_summary_error
    );

    // --- KPIs & Global Error Handling ---
    if (!facultyData || facultyData.error) {
        const errorMsg = facultyData?.error || "Faculty data unavailable";
        console.error("Faculty data error:", errorMsg);
        const chartIds = ['ratingsChart', 'deptRatingsChart', 'facultySemesterChart',
                          'ratingTrendsChart', 'topFacultyChart', 'courseRatingChart'];
        // Use the specific error for the chart that was replaced if available
        const ratingDistError = (facultyData && facultyData.rating_distribution && facultyData.rating_distribution.error) ? facultyData.rating_distribution.error : errorMsg;
        chartIds.forEach(id => {
            if (id === 'ratingsChart') {
                 displayErrorOnChart(id, ratingDistError); // Show specific error if distribution failed
            } else {
                 // Check if specific data for other charts has an error key
                 let specificError = errorMsg; // Default to general error
                 if (id === 'deptRatingsChart' && facultyData?.dept_teaching_ratings?.error) specificError = facultyData.dept_teaching_ratings.error;
                 else if (id === 'facultySemesterChart' && facultyData?.semester_ratings?.error) specificError = facultyData.semester_ratings.error;
                 else if (id === 'ratingTrendsChart' && facultyData?.yearly_average_trend?.error) specificError = facultyData.yearly_average_trend.error;
                 else if (id === 'topFacultyChart' && facultyData?.top_faculty?.error) specificError = facultyData.top_faculty.error;
                 else if (id === 'courseRatingChart' && facultyData?.course_ratings?.error) specificError = facultyData.course_ratings.error;

                 displayErrorOnChart(id, specificError); // Show specific error if available
            }
        });
        updateKPI('kpi-avg-rating', null, '', 'Error');
        updateComparisonNote('dept-rating-comparison-note', null);
        return; // Don't proceed if main data failed
    }

    // --- Clear Previous Errors ---
    const chartIds = ['ratingsChart', 'deptRatingsChart', 'facultySemesterChart',
                       'ratingTrendsChart', 'topFacultyChart', 'courseRatingChart'];
    chartIds.forEach(clearErrorOnChart);

     // --- Update KPI ---
     updateKPI('kpi-avg-rating', facultyData.kpi_overall_avg_rating);

    // --- Create Charts ---
    // Rating Distribution (Bar Chart)
    if (facultyData.rating_distribution && typeof facultyData.rating_distribution === 'object' && !facultyData.rating_distribution.error && Object.keys(facultyData.rating_distribution).length > 0) {
        // Create bar chart: keys (1-5) on X-axis, counts on Y-axis
        createBarChart('ratingsChart', facultyData.rating_distribution, 'Number of Reviews', null); // Max Y auto, not percent
    } else {
        // Display error if distribution data is missing or backend indicated error
        displayErrorOnChart('ratingsChart', facultyData.rating_distribution?.error || 'Rating Distribution data unavailable');
    }

    // Department Teaching Ratings (Bar)
    const overallAvgRating = facultyData.kpi_overall_avg_rating;
    if (facultyData.dept_teaching_ratings && typeof facultyData.dept_teaching_ratings === 'object' && !facultyData.dept_teaching_ratings.error && Object.keys(facultyData.dept_teaching_ratings).length > 0) {
        createBarChart('deptRatingsChart', facultyData.dept_teaching_ratings, 'Avg Rating', 5);
        updateComparisonNote('dept-rating-comparison-note', overallAvgRating, '', 'Overall Avg: ');
    } else {
        displayErrorOnChart('deptRatingsChart', facultyData.dept_teaching_ratings?.error || 'Department Rating data unavailable');
        updateComparisonNote('dept-rating-comparison-note', null);
    }

     // Semester Rating Comparison (Bar)
    if (facultyData.semester_ratings && typeof facultyData.semester_ratings === 'object' && !facultyData.semester_ratings.error && Object.keys(facultyData.semester_ratings).length > 0) {
        createBarChart('facultySemesterChart', facultyData.semester_ratings, 'Avg Rating', 5);
    } else {
         displayErrorOnChart('facultySemesterChart', facultyData.semester_ratings?.error || 'Semester Rating data unavailable');
    }

    // Overall Faculty Rating Trend (Yearly) (Line)
    if (facultyData.yearly_average_trend && typeof facultyData.yearly_average_trend === 'object' && !facultyData.yearly_average_trend.error && Object.keys(facultyData.yearly_average_trend).length > 1) {
        createTrendChart('ratingTrendsChart', facultyData.yearly_average_trend, 'Overall Avg Rating');
    } else if (facultyData.yearly_average_trend && typeof facultyData.yearly_average_trend === 'object' && !facultyData.yearly_average_trend.error && Object.keys(facultyData.yearly_average_trend).length === 1){
        displayErrorOnChart('ratingTrendsChart', 'Only one data point found for yearly rating trend');
    }
     else {
        displayErrorOnChart('ratingTrendsChart', facultyData.yearly_average_trend?.error || 'Yearly Rating Trend data unavailable');
    }

    // Top Rated Faculty (Horizontal Bar) - Display Top 5
    if (facultyData.top_faculty && typeof facultyData.top_faculty === 'object' && !facultyData.top_faculty.error && Object.keys(facultyData.top_faculty).length > 0) {
         const top5Faculty = Object.fromEntries(Object.entries(facultyData.top_faculty).slice(0, 5));
        createHorizontalBarChart('topFacultyChart', top5Faculty, 'Avg Rating', 5);
    } else {
        displayErrorOnChart('topFacultyChart', facultyData.top_faculty?.error || 'Top Rated Faculty data unavailable');
    }

    // Top Rated Courses (Horizontal Bar) - Display Top 5
    if (facultyData.course_ratings && typeof facultyData.course_ratings === 'object' && !facultyData.course_ratings.error && Object.keys(facultyData.course_ratings).length > 0) {
        const top5Courses = Object.fromEntries(Object.entries(facultyData.course_ratings).slice(0, 5));
        createHorizontalBarChart('courseRatingChart', top5Courses, 'Avg Rating', 5);
    } else {
        displayErrorOnChart('courseRatingChart', facultyData.course_ratings?.error || 'Top Rated Courses data unavailable');
    }
}

// --- Tab Navigation (keep as is) ---
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Check if any tab is explicitly marked active in HTML, otherwise activate the first
     const firstLoadActive = !Array.from(tabButtons).some(btn => btn.classList.contains('active'));
     if (firstLoadActive && tabButtons.length > 0) {
         tabButtons[0].classList.add('active');
         if (tabContents.length > 0) tabContents[0].classList.add('active');
     }


    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const onclickAttr = button.getAttribute('onclick');
            const match = onclickAttr ? onclickAttr.match(/showTab\('([^']+)'\)/) : null;
            if (match && match[1]) {
                showTab(match[1]);
            }
        });
    });
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content.active').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button.active').forEach(button => button.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    const targetButton = Array.from(document.querySelectorAll('.tab-button')).find(
        btn => btn.getAttribute('onclick') === `showTab('${tabId}')`
    );

    if (targetTab) targetTab.classList.add('active');
    if (targetButton) targetButton.classList.add('active');

    console.log(`Switched to tab: ${tabId}`);
}

// --- Reusable Chart Creation Functions (keep as is) ---
// No changes needed in the chart creation functions themselves.
// --- Paste your existing createBarChart, createHorizontalBarChart, createPieChart, createScatterPlot, createMarksComparisonChart, createTrendChart, createStackedBarChart functions here ---
function destroyChartIfExists(elementId) {
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();
}

function createBarChart(elementId, data, label, maxValue, percent = false) {
    const canvas = document.getElementById(elementId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    clearErrorOnChart(elementId); // Clear previous errors before trying again
    destroyChartIfExists(elementId);

    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        // Don't display error here if backend already provided an error message for this chart
        // displayErrorOnChart(elementId, `No data available for chart`);
        return;
    }

    // Prepare labels & values, potentially sorting keys alpha
    const sortedKeys = Object.keys(data).sort();
    const labels = sortedKeys;
    const values = sortedKeys.map(key => data[key]);


    try {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    backgroundColor: '#0d6efd', // Bootstrap primary slightly lighter
                    borderColor: '#0d6efd',
                    borderWidth: 1,
                    borderRadius: 5,
                    hoverBackgroundColor: '#0b5ed7' // Darker blue on hover
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let value = context.raw;
                                if (typeof value !== 'number') return 'N/A';
                                const formattedValue = percent ? `${(value * 100).toFixed(1)}%` : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
                                return `${context.dataset.label}: ${formattedValue}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: maxValue, // Use maxValue if provided (e.g., 1 for %, 10 for CGPA, 5 for Rating)
                        grid: { color: '#e9ecef', drawBorder: false },
                        ticks: {
                            color: '#6c757d', // Axis text color
                            precision: percent ? 0 : undefined, // Control decimal places for ticks
                             callback: function(value) {
                                 if (percent) return `${(value * 100).toFixed(0)}%`;
                                 // Format large numbers? e.g., > 1000 -> 1k
                                 return value.toLocaleString();
                            }
                         }
                    },
                    x: {
                         grid: { display: false },
                         ticks: { color: '#6c757d', autoSkip: true, maxRotation: 45, minRotation: 0 } // Allow rotation for long labels
                    }
                },
                animation: { duration: 700, easing: 'easeOutQuad' }
            }
        });
    } catch (error) {
        console.error(`Chart.js error creating Bar Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart rendering failed: ${error.message}`);
    }
}

function createHorizontalBarChart(elementId, data, label, maxValue) {
    const canvas = document.getElementById(elementId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    clearErrorOnChart(elementId);
    destroyChartIfExists(elementId);

    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        // displayErrorOnChart(elementId, `No data available`);
        return;
    }

     const sortedEntries = Object.entries(data).sort(([, a], [, b]) => b - a); // Sort values descending
     const sortedLabels = sortedEntries.map(([key]) => key);
     const sortedValues = sortedEntries.map(([, value]) => value);


    try {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedLabels,
                datasets: [{
                    label: label,
                    data: sortedValues,
                    backgroundColor: '#17a2b8', // Bootstrap info/cyan
                    borderColor: '#17a2b8',
                    borderWidth: 1,
                    borderRadius: { topRight: 5, bottomRight: 5 } // Round end of bars
                }]
            },
            options: {
                indexAxis: 'y', // Makes it horizontal
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                     tooltip: {
                        callbacks: {
                           label: (context) => `${context.dataset.label}: ${context.raw?.toLocaleString() ?? 'N/A'}`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: maxValue, // Optional max for consistent scale (e.g., rating)
                        grid: { color: '#e9ecef', drawBorder: false },
                        ticks: { color: '#6c757d', precision: 0 } // Integers for counts
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#495057' } // Darker labels for better readability
                    }
                },
                animation: { duration: 700, easing: 'easeOutQuad' }
            }
        });
     } catch (error) {
        console.error(`Chart.js error creating Horizontal Bar Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart rendering failed: ${error.message}`);
    }
}

function createPieChart(elementId, data) {
    const canvas = document.getElementById(elementId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    clearErrorOnChart(elementId);
    destroyChartIfExists(elementId);

    if (!data || typeof data !== 'object' || Object.values(data).every(v => v === 0)) {
        // displayErrorOnChart(elementId, `No data available for pie chart`);
        return;
    }

    const labels = Object.keys(data);
    const values = Object.values(data);

    const colorPalette = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14', '#20c997', '#6c757d']; // Bootstrap-ish
    const backgroundColors = labels.map((_, index) => colorPalette[index % colorPalette.length]);

    try {
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: backgroundColors,
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 6 // Make slice pop slightly more
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 15, padding: 20 } },
                    tooltip: {
                         callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                let value = context.raw;
                                // Ensure the dataset has meta information before accessing total
                                const meta = context.chart.getDatasetMeta(0);
                                let total = meta?.total ?? 1; // Use meta total, avoid div by zero
                                let percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                                return `${label}: ${value.toLocaleString()} (${percentage})`;
                            }
                        }
                    }
                },
                animation: { duration: 900, easing: 'easeOutExpo' }
            }
        });
    } catch (error) {
        console.error(`Chart.js error creating Pie Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart rendering failed: ${error.message}`);
    }
}

function createScatterPlot(elementId, data) {
     const canvas = document.getElementById(elementId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    clearErrorOnChart(elementId);
    destroyChartIfExists(elementId);

    // Data validation now happens primarily in backend; frontend checks array existence/length
    if (!data || !Array.isArray(data.cgpa) || !Array.isArray(data.package) || data.cgpa.length !== data.package.length || data.cgpa.length === 0) {
        // displayErrorOnChart(elementId, "Invalid or empty CGPA/Package data for Scatter Plot");
        return;
    }

    const scatterData = [];
    for (let i = 0; i < data.cgpa.length; i++) {
        // Frontend parsing assumes backend sent valid numbers or nulls
        const cgpa = data.cgpa[i]; // Assume numbers or null
        const pkg = data.package[i];
        // Only plot if both are valid numbers
        if (typeof cgpa === 'number' && !isNaN(cgpa) && typeof pkg === 'number' && !isNaN(pkg)) {
            scatterData.push({ x: cgpa, y: pkg });
        }
    }

    if (scatterData.length === 0) {
        displayErrorOnChart(elementId, "No valid numeric pairs found for Scatter Plot");
        return;
    }

    try {
        new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Student', // Tooltip context
                    data: scatterData,
                    backgroundColor: 'rgba(13, 110, 253, 0.6)', // Primary transparent
                    borderColor: 'rgba(13, 110, 253, 0.8)',
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear', position: 'bottom',
                        title: { display: true, text: 'CGPA', font: { weight: 'bold' }, color: '#495057' },
                        grid: { color: '#e9ecef' },
                        ticks: { color: '#6c757d', precision: 1 }, // Allow one decimal for CGPA ticks
                         suggestedMin: Math.max(0, Math.min(...scatterData.map(d => d.x)) - 0.5), // Dynamic min based on data
                         suggestedMax: Math.min(10, Math.max(...scatterData.map(d => d.x)) + 0.5) // Dynamic max
                    },
                    y: {
                        type: 'linear',
                        title: { display: true, text: 'Package (LPA)', font: { weight: 'bold' }, color: '#495057' },
                        beginAtZero: true,
                        grid: { color: '#e9ecef' },
                        ticks: {
                            color: '#6c757d',
                            callback: (value) => `₹${value.toLocaleString()}L`
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const xVal = context.parsed?.x;
                                const yVal = context.parsed?.y;
                                if (typeof xVal === 'number' && typeof yVal === 'number') {
                                    return `CGPA: ${xVal.toFixed(2)}, Package: ₹${yVal.toFixed(1)} LPA`; // Show 1 decimal for package
                                }
                                return 'Data point';
                            }
                        }
                    }
                }
                // No specific animation needed usually
            }
        });
     } catch (error) {
        console.error(`Chart.js error creating Scatter Plot (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart rendering failed: ${error.message}`);
    }
}

function createMarksComparisonChart(elementId, data) {
     const canvas = document.getElementById(elementId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    clearErrorOnChart(elementId);
    destroyChartIfExists(elementId);

    const datasets = [];
    if (data && typeof data.Internal === 'number' && !isNaN(data.Internal)) {
        datasets.push({ label: 'Internal', data: [data.Internal], backgroundColor: '#17a2b8', borderRadius: 5 }); // Cyan
    }
    if (data && typeof data.External === 'number' && !isNaN(data.External)) {
        datasets.push({ label: 'External', data: [data.External], backgroundColor: '#fd7e14', borderRadius: 5 }); // Orange
    }

    if (datasets.length === 0) {
       // displayErrorOnChart(elementId, 'No valid Internal/External mark data found');
       return;
    }

    try {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Average Marks'], // Single category
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                 plugins: { legend: { position: 'top' } },
                 scales: {
                     y: { beginAtZero: true, title: { display: false }, max: 100 }, // Scale 0-100
                     x: { grid: { display: false }, ticks: { display: false } }
                 },
                  tooltip: {
                       callbacks: {
                           title: () => '', // Hide title
                           label: (context) => `${context.dataset.label}: ${context.raw?.toFixed(1) ?? 'N/A'}`
                       }
                   },
                animation: { duration: 700, easing: 'easeOutQuad' }
            }
        });
     } catch (error) {
        console.error(`Chart.js error creating Marks Comparison Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart rendering failed: ${error.message}`);
    }
}

function createTrendChart(elementId, data, label) {
     const canvas = document.getElementById(elementId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    clearErrorOnChart(elementId);
    destroyChartIfExists(elementId);

    if (!data || typeof data !== 'object' || Object.keys(data).length < 2) { // Need at least 2 points for a trend
        // displayErrorOnChart(elementId, `Insufficient data for ${label} trend (requires >= 2 points)`);
        return;
    }

    const sortedKeys = Object.keys(data).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    const labels = sortedKeys;
    const values = sortedKeys.map(key => {
        const val = parseFloat(data[key]);
        return Number.isFinite(val) ? val : null; // Ensure only finite numbers or null are used
    });


    // Check if enough valid points exist *after* parsing
    if (values.filter(v => v !== null).length < 2) {
         displayErrorOnChart(elementId, `Not enough valid numeric data points for ${label} trend`);
         return;
     }

    try {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    borderColor: '#0d6efd', // Primary blue
                    backgroundColor: 'rgba(13, 110, 253, 0.1)', // Light blue fill
                    fill: true, // Add fill below line
                    borderWidth: 2.5,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#0d6efd',
                    tension: 0.1, // Slight curve
                    spanGaps: true // Connect over null points
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                 plugins: {
                    legend: { display: false }, // Often cleaner without if title is clear
                     tooltip: {
                         intersect: false, mode: 'index',
                         callbacks: {
                             label: (context) => `${label}: ${context.raw?.toFixed(2) ?? 'N/A'}`
                         }
                     }
                },
                scales: {
                    y: {
                        beginAtZero: false, // Start axis near data range
                        grid: { color: '#e9ecef' }, ticks: { color: '#6c757d' }
                        // Consider suggested min/max if applicable (e.g., ratings)
                    },
                    x: {
                        grid: { display: false }, ticks: { color: '#6c757d' }
                    }
                },
                animation: { duration: 800, easing: 'easeOutCubic' }
            }
        });
     } catch (error) {
        console.error(`Chart.js error creating Trend Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart rendering failed: ${error.message}`);
    }
}

function createStackedBarChart(elementId, data) {
     const canvas = document.getElementById(elementId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    clearErrorOnChart(elementId);
    destroyChartIfExists(elementId);

    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        // displayErrorOnChart(elementId, 'No data for Stacked Bar Chart');
        return;
    }

    const categories = Object.keys(data).sort(); // Sort categories alpha
    const datasetConfig = [ // Order: Placed on top
        { label: 'Placed', key: '1', color: '#198754', radius: { topLeft: 5, topRight: 5 } }, // Green
        { label: 'Not Placed', key: '0', color: '#dc3545', radius: { bottomLeft: 5, bottomRight: 5 } } // Red
    ];
    const datasets = datasetConfig.map(config => ({
        label: config.label,
        data: categories.map(category => parseInt(data[category]?.[config.key] || 0)),
        backgroundColor: config.color,
        borderRadius: config.radius
    }));

    // Check if all data values are zero AFTER parsing
    if (datasets.every(ds => ds.data.every(val => val === 0))) {
          displayErrorOnChart(elementId, 'All counts are zero');
          return;
     }

    try {
        new Chart(ctx, {
            type: 'bar',
            data: { labels: categories, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                 plugins: { legend: { position: 'top' } },
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { color: '#6c757d' } },
                    y: {
                        stacked: true, beginAtZero: true,
                        title: { display: true, text: 'Number of Students', color: '#6c757d', font:{size:11} },
                        grid: { color: '#e9ecef', drawBorder: false },
                        ticks: { color: '#6c757d', precision: 0 }
                    }
                },
                 tooltip: {
                     mode: 'index', // Show both values on hover
                      callbacks: {
                         label: (context) => `${context.dataset.label}: ${context.raw?.toLocaleString() ?? 'N/A'}`
                     }
                 },
                animation: { duration: 700, easing: 'easeOutQuad' }
            }
        });
     } catch (error) {
        console.error(`Chart.js error creating Stacked Bar Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart rendering failed: ${error.message}`);
    }
}

// --- NEW: AI Query Handling ---
function showAIQueryStatus(message, isError = false) {
    if (!aiQueryStatus || !aiQueryResponse || !aiQueryStatusText) return;
    aiQueryResponse.innerHTML = ''; // Clear previous response
    aiQueryResponse.classList.remove('error');
    aiQueryStatusText.textContent = message;
    aiQueryStatus.style.display = 'flex'; // Show status
    if (isError) {
        aiQueryStatus.classList.add('error'); // Add error class for styling
    } else {
        aiQueryStatus.classList.remove('error');
    }
}

function hideAIQueryStatus() {
     if (aiQueryStatus) aiQueryStatus.style.display = 'none';
}

function displayAIAnswer(answer) {
     if (!aiQueryResponse) return;
     hideAIQueryStatus();
     // Sanitize? For now, treat as text and replace newlines
     aiQueryResponse.innerHTML = answer.replace(/\n/g, '<br>');
     aiQueryResponse.classList.remove('error');
}

function displayAIError(errorMessage) {
     if (!aiQueryResponse) return;
     hideAIQueryStatus();
     aiQueryResponse.textContent = `Error: ${errorMessage}`;
     aiQueryResponse.classList.add('error'); // Add error class for styling
}

async function handleAIQuerySubmit() {
    if (!aiQueryInput || !aiQuerySubmit) return;

    const question = aiQueryInput.value.trim();
    if (!question) {
        displayAIError("Please enter a question.");
        return;
    }

    showAIQueryStatus("Thinking..."); // Show loading state
    aiQuerySubmit.disabled = true; // Disable button during request
    aiQueryInput.disabled = true;

    try {
        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question: question }),
        });

        const result = await response.json();

        if (!response.ok) {
            // Handle HTTP errors (4xx, 5xx)
            throw new Error(result.error || `Request failed with status ${response.status}`);
        }

        if (result.error) {
            // Handle errors reported in the JSON payload (e.g., parser error, Gemini error)
            displayAIError(result.error);
        } else if (result.answer) {
            // Display successful answer
            displayAIAnswer(result.answer);
        } else {
            // Unexpected: No answer and no error
             displayAIError("Received an unexpected response from the server.");
        }

    } catch (error) {
        console.error("Error submitting AI query:", error);
        displayAIError(`Network or server error: ${error.message}`);
    } finally {
        aiQuerySubmit.disabled = false; // Re-enable button
        aiQueryInput.disabled = false;
         // Optionally hide status only on success? Or always hide? Let's always hide.
         // hideAIQueryStatus(); // Already hidden by displayAIAnswer/displayAIError
    }
}


// --- Main Execution ---
document.addEventListener('DOMContentLoaded', async () => {
    showLoading(); // Show loader right away
    setupTabNavigation();

    // --- NEW: Setup AI Query Listener ---
    if (aiQuerySubmit && aiQueryInput) {
        aiQuerySubmit.addEventListener('click', handleAIQuerySubmit);
        // Optional: Allow submitting with Enter key in input field
        aiQueryInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent default form submission if it were in a form
                handleAIQuerySubmit();
            }
        });
    } else {
        console.warn("AI Query elements not found.");
    }
    // --- End NEW ---

    const dashboardData = await fetchDashboardData(); // Fetch data (handles loader hide/error)

    if (!dashboardData) {
        console.error("Dashboard data fetch failed. Cannot initialize dashboard.");
        // Optionally display errors in summary sections too
        updateSummaryDisplay('exam-summary', 'exam-summary-error', null, 'Failed to load data');
        updateSummaryDisplay('placement-summary', 'placement-summary-error', null, 'Failed to load data');
        updateSummaryDisplay('faculty-summary', 'faculty-summary-error', null, 'Failed to load data');
        // Add generic error messages to some key charts if needed
        displayErrorOnChart('gradeChart', 'Failed to load data');
        displayErrorOnChart('placementRateChart', 'Failed to load data');
        displayErrorOnChart('ratingsChart', 'Failed to load data');
        displayAIError('Dashboard data could not be loaded. Query feature unavailable.'); // Show error in AI query box too
        return;
    }

     clearGlobalErrorMessage(); // Clear if fetch was successful

    // Initialize each section, checking for the data key first
    // Pass the specific data slice or an object indicating error
    initializeExamCharts(dashboardData.exam_data || { error: 'Exam data not found in response', gemini_summary_error: 'Data missing' });
    initializePlacementCharts(dashboardData.placement_data || { error: 'Placement data not found in response', gemini_summary_error: 'Data missing' });
    initializeFacultyCharts(dashboardData.faculty_data || { error: 'Faculty data not found in response', gemini_summary_error: 'Data missing' });

    console.log("Dashboard initialized.");
});
