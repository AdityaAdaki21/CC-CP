// static/js/dashboard.js

// Chart.js defaults
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

// --- Data Fetching and Error Handling ---
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
        console.log("API Data Received:", JSON.parse(JSON.stringify(data))); // Deep copy log
        // Check if backend explicitly sent an error object for a section
        if (data.exam_data?.error || data.placement_data?.error || data.faculty_data?.error) {
             console.warn("Data fetched but contains errors in sections:", data);
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
        errorMsgElement.style.position = 'absolute';
        errorMsgElement.style.inset = '0';
        errorMsgElement.style.display = 'flex';
        errorMsgElement.style.justifyContent = 'center';
        errorMsgElement.style.alignItems = 'center';
        errorMsgElement.style.padding = '15px';
        errorMsgElement.style.color = '#dc3545'; // Danger color
        errorMsgElement.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'; // slight bg
        errorMsgElement.style.textAlign = 'center';
        errorMsgElement.style.fontSize = '13px';
        errorMsgElement.style.fontWeight = '500';
        errorMsgElement.style.zIndex = '10';
        errorMsgElement.style.borderRadius = 'inherit'; // Match card corner radius
        chartContainer.appendChild(errorMsgElement);
    }

    // Hide the canvas, show the error message
    canvas.style.display = 'none';
    errorMsgElement.textContent = message;
    errorMsgElement.style.display = 'flex';
}

function clearErrorOnChart(canvasId) {
     const canvas = document.getElementById(canvasId);
     const chartContainer = canvas ? canvas.closest('.chart-container') : null;
     if (!chartContainer) return;

     const errorMsgElement = chartContainer.querySelector('.chart-error-message');
     if (errorMsgElement) errorMsgElement.style.display = 'none'; // Hide the error
     if (canvas) canvas.style.display = 'block'; // Show the canvas
}


// --- Initialization Functions ---

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

// --- Section Initializers ---

function initializeExamCharts(examData) {
    // --- KPIs & Global Error Handling ---
    if (!examData || examData.error) {
        const errorMsg = examData?.error || "Exam data unavailable";
        console.error("Exam data error:", errorMsg);
        // Display errors on all canvases for this section
        displayErrorOnChart('gradeChart', errorMsg);
        displayErrorOnChart('departmentPerformanceChart', errorMsg);
        displayErrorOnChart('topSubjectsChart', errorMsg);
        displayErrorOnChart('marksComparisonChart', errorMsg);
        displayErrorOnChart('semesterChart', errorMsg);
        // Update KPIs to show error/NA
        updateKPI('kpi-avg-mark', null, '', 'Error');
        updateKPI('kpi-grade-overview', null, '', 'Error');
        updateComparisonNote('dept-perf-comparison-note', null); // Clear note
        return;
    }

    // --- Clear Previous Errors ---
    clearErrorOnChart('gradeChart');
    clearErrorOnChart('departmentPerformanceChart');
    clearErrorOnChart('topSubjectsChart');
    clearErrorOnChart('marksComparisonChart');
    clearErrorOnChart('semesterChart');

    // --- Update KPIs ---
    updateKPI('kpi-avg-mark', examData.kpi_overall_avg_mark);
    if (examData.grade_distribution && Object.keys(examData.grade_distribution).length > 0) {
        // Find grade with highest count
         const mostCommonGrade = Object.entries(examData.grade_distribution)
             .sort(([, countA], [, countB]) => countB - countA)[0]?.[0]; // Get key of first entry after sort
         updateKPI('kpi-grade-overview', mostCommonGrade || 'N/A', '', 'N/A');
     } else {
         updateKPI('kpi-grade-overview', null); // Use default 'N/A'
     }


    // --- Create Charts ---

    // Grade Distribution (Pie)
    if (examData.grade_distribution && Object.values(examData.grade_distribution).some(v => v > 0)) {
        createPieChart('gradeChart', examData.grade_distribution);
    } else {
        displayErrorOnChart('gradeChart', 'No Grade Distribution data found');
    }

    // Department Performance (Bar)
     const overallAvgMark = examData.kpi_overall_avg_mark;
    if (examData.performance_by_department && Object.keys(examData.performance_by_department).length > 0) {
        createBarChart('departmentPerformanceChart', examData.performance_by_department, 'Avg Mark', 100); // Scale 0-100
        updateComparisonNote('dept-perf-comparison-note', overallAvgMark);
    } else {
         displayErrorOnChart('departmentPerformanceChart', 'No Department Performance data found');
          updateComparisonNote('dept-perf-comparison-note', null);
    }

    // Top Performing Subjects (Horizontal Bar)
    if (examData.subject_performance && Object.keys(examData.subject_performance).length > 0) {
        createHorizontalBarChart('topSubjectsChart', examData.subject_performance, 'Avg Mark', 100); // Scale 0-100
    } else {
        displayErrorOnChart('topSubjectsChart', 'No Top Subject Performance data found');
    }

    // Internal vs External Marks Comparison (Bar)
     const comparisonData = {};
     let hasComparisonData = false;
     if (examData.marks_comparison) {
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

     // Yearly Performance Trend (Line) - using 'semester_performance' key from backend
     if (examData.semester_performance && Object.keys(examData.semester_performance).length > 1) { // Need > 1 point for a trend
         createTrendChart('semesterChart', examData.semester_performance, 'Avg Marks');
    } else if (examData.semester_performance && Object.keys(examData.semester_performance).length === 1){
        displayErrorOnChart('semesterChart', 'Only one data point found for yearly trend');
    } else {
        displayErrorOnChart('semesterChart', 'No Yearly Performance Trend data found');
    }
}

function initializePlacementCharts(placementData) {
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
        return;
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
    if (placementData.placement_rate_by_dept && Object.keys(placementData.placement_rate_by_dept).length > 0) {
        createBarChart('placementRateChart', placementData.placement_rate_by_dept, 'Placement Rate', 1, true); // percent = true
        updateComparisonNote('placement-rate-comparison-note', overallPlacementRate, '', 'Overall: ');
    } else {
        displayErrorOnChart('placementRateChart', 'No Department Placement Rate data found');
         updateComparisonNote('placement-rate-comparison-note', null);
    }

    // Average Package by Department (Bar)
    const overallAvgPackage = placementData.kpi_overall_avg_package;
    if (placementData.package_by_dept && Object.keys(placementData.package_by_dept).length > 0) {
        createBarChart('packageChart', placementData.package_by_dept, 'Avg Package (LPA)', null);
        updateComparisonNote('package-dept-comparison-note', overallAvgPackage, ' LPA', 'Overall Avg: ');
    } else {
         displayErrorOnChart('packageChart', 'No Avg Package by Department data found');
          updateComparisonNote('package-dept-comparison-note', null);
    }

    // Gender Placement Comparison (Stacked Bar)
    if (placementData.gender_placement && typeof placementData.gender_placement === 'object' && Object.keys(placementData.gender_placement).length > 0 && !placementData.gender_placement.error) {
        const hasCounts = Object.values(placementData.gender_placement).some(counts => (parseInt(counts['0']||0) + parseInt(counts['1']||0)) > 0);
        if (hasCounts) {
            createStackedBarChart('genderPlacementChart', placementData.gender_placement);
        } else {
             displayErrorOnChart('genderPlacementChart', 'No counts found for Gender Placement');
        }
    } else {
        displayErrorOnChart('genderPlacementChart', placementData.gender_placement?.error || 'Gender Placement data unavailable');
    }

    // CGPA Distribution (Bar)
    if (placementData.cgpa_distribution && Object.keys(placementData.cgpa_distribution).length > 0 && !placementData.cgpa_distribution.error) {
        createBarChart('cgpaDistributionChart', placementData.cgpa_distribution, 'No. of Students', null);
    } else {
        displayErrorOnChart('cgpaDistributionChart', placementData.cgpa_distribution?.error || 'CGPA Distribution data unavailable');
    }

    // Avg CGPA Placed vs. Not Placed (Bar)
    if (placementData.avg_cgpa_by_placement && Object.keys(placementData.avg_cgpa_by_placement).length > 0 && !placementData.avg_cgpa_by_placement.error) {
         createBarChart('cgpaPlacedVsUnplacedChart', placementData.avg_cgpa_by_placement, 'Average CGPA', 10); // Max CGPA 10
    } else {
         displayErrorOnChart('cgpaPlacedVsUnplacedChart', placementData.avg_cgpa_by_placement?.error || 'Avg CGPA comparison unavailable');
    }

    // CGPA vs Package (Scatter)
    if (placementData.cgpa_package_data && placementData.cgpa_package_data.cgpa?.length > 0) { // Check length after backend ensures match
        createScatterPlot('cgpaPackageChart', placementData.cgpa_package_data);
    } else {
        displayErrorOnChart('cgpaPackageChart', 'Insufficient data for CGPA vs Package plot');
    }

    // Top Recruiting Companies (Horizontal Bar)
    if (placementData.top_companies && Object.keys(placementData.top_companies).length > 0 && !placementData.top_companies.error) {
        createHorizontalBarChart('companiesChart', placementData.top_companies, 'No. of Placements');
    } else {
         displayErrorOnChart('companiesChart', placementData.top_companies?.error || 'Top Companies data unavailable');
    }

    // Most In-Demand Skills (Horizontal Bar)
    if (placementData.top_skills && Object.keys(placementData.top_skills).length > 0 && !placementData.top_skills.error) {
        createHorizontalBarChart('skillsChart', placementData.top_skills, 'Frequency');
    } else {
        displayErrorOnChart('skillsChart', placementData.top_skills?.error || 'Top Skills data unavailable');
    }
}

function initializeFacultyCharts(facultyData) {
    // --- KPIs & Global Error Handling ---
    if (!facultyData || facultyData.error) {
        const errorMsg = facultyData?.error || "Faculty data unavailable";
        console.error("Faculty data error:", errorMsg);
        const chartIds = ['ratingsChart', 'deptRatingsChart', 'facultySemesterChart',
                          'ratingTrendsChart', 'topFacultyChart', 'courseRatingChart'];
        // Use the specific error for the chart that was replaced if available
        const ratingDistError = facultyData.rating_distribution?.error ? facultyData.rating_distribution.error : errorMsg;
        chartIds.forEach(id => {
            if (id === 'ratingsChart') {
                 displayErrorOnChart(id, ratingDistError); // Show specific error if distribution failed
            } else {
                 displayErrorOnChart(id, errorMsg); // General error for others
            }
        });
        updateKPI('kpi-avg-rating', null, '', 'Error');
        updateComparisonNote('dept-rating-comparison-note', null);
        return;
    }

    // --- Clear Previous Errors ---
    const chartIds = ['ratingsChart', 'deptRatingsChart', 'facultySemesterChart',
                       'ratingTrendsChart', 'topFacultyChart', 'courseRatingChart'];
    chartIds.forEach(clearErrorOnChart);

     // --- Update KPI ---
     updateKPI('kpi-avg-rating', facultyData.kpi_overall_avg_rating);

    // --- Create Charts ---

    // *** REPLACED RADAR CHART ***
    // Rating Distribution (Bar Chart)
    if (facultyData.rating_distribution && Object.keys(facultyData.rating_distribution).length > 0 && !facultyData.rating_distribution.error) {
        // Create bar chart: keys (1-5) on X-axis, counts on Y-axis
        createBarChart('ratingsChart', facultyData.rating_distribution, 'Number of Reviews', null); // Max Y auto, not percent
    } else {
        // Display error if distribution data is missing or backend indicated error
        displayErrorOnChart('ratingsChart', facultyData.rating_distribution?.error || 'Rating Distribution data unavailable');
    }

    // Department Teaching Ratings (Bar)
    const overallAvgRating = facultyData.kpi_overall_avg_rating;
    if (facultyData.dept_teaching_ratings && Object.keys(facultyData.dept_teaching_ratings).length > 0) {
        createBarChart('deptRatingsChart', facultyData.dept_teaching_ratings, 'Avg Rating', 5);
        updateComparisonNote('dept-rating-comparison-note', overallAvgRating, '', 'Overall Avg: ');
    } else {
        displayErrorOnChart('deptRatingsChart', 'Department Rating data unavailable');
        updateComparisonNote('dept-rating-comparison-note', null);
    }

    // Semester Rating Comparison (Bar)
    if (facultyData.semester_ratings && Object.keys(facultyData.semester_ratings).length > 0) {
        createBarChart('facultySemesterChart', facultyData.semester_ratings, 'Avg Rating', 5);
    } else {
         displayErrorOnChart('facultySemesterChart', 'Semester Rating data unavailable');
    }

    // Overall Faculty Rating Trend (Yearly) (Line)
    if (facultyData.yearly_average_trend && Object.keys(facultyData.yearly_average_trend).length > 1) {
        createTrendChart('ratingTrendsChart', facultyData.yearly_average_trend, 'Overall Avg Rating');
    } else if (facultyData.yearly_average_trend && Object.keys(facultyData.yearly_average_trend).length === 1){
        displayErrorOnChart('ratingTrendsChart', 'Only one data point found for yearly rating trend');
    }
     else {
        displayErrorOnChart('ratingTrendsChart', 'Yearly Rating Trend data unavailable');
    }

    // Top Rated Faculty (Horizontal Bar)
    if (facultyData.top_faculty && Object.keys(facultyData.top_faculty).length > 0) {
        createHorizontalBarChart('topFacultyChart', facultyData.top_faculty, 'Avg Rating', 5);
    } else {
        displayErrorOnChart('topFacultyChart', 'Top Rated Faculty data unavailable');
    }

    // Top Rated Courses (Horizontal Bar)
    if (facultyData.course_ratings && Object.keys(facultyData.course_ratings).length > 0) {
        createHorizontalBarChart('courseRatingChart', facultyData.course_ratings, 'Avg Rating', 5);
    } else {
        displayErrorOnChart('courseRatingChart', 'Top Rated Courses data unavailable');
    }
}

// --- Tab Navigation ---
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
    // Optional: Force redraw charts in the new tab if they render oddly
    // window.dispatchEvent(new Event('resize'));
}


// --- Reusable Chart Creation Functions ---

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
        displayErrorOnChart(elementId, `No data available for chart`);
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
        displayErrorOnChart(elementId, `No data available`);
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
        displayErrorOnChart(elementId, `No data available for pie chart`);
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
                                let total = context.chart.getDatasetMeta(0)?.total ?? 1; // Avoid div by zero
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


function createDoughnutChart(elementId, data) { /* ... same as pie, just type:'doughnut', add cutout option ... */ }


function formatRatingLabel(key) {
    return key.replace(/^Rating_/i, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}


function createRadarChart(elementId, data) {
     const canvas = document.getElementById(elementId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    clearErrorOnChart(elementId);
    destroyChartIfExists(elementId);

    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
         displayErrorOnChart(elementId, 'No data for Radar Chart');
         return;
    }

    const labels = Object.keys(data).map(formatRatingLabel);
    const values = Object.values(data).map(v => (typeof v === 'number' && !isNaN(v) ? v : 0));

     if (labels.length === 0 || values.every(v => v === 0)) {
         displayErrorOnChart(elementId, 'No valid data points for Radar Chart');
         return;
     }

    const maxScale = 5; // Assumed rating scale

    try {
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Average Rating', // Used in tooltip
                    data: values,
                    backgroundColor: 'rgba(23, 162, 184, 0.2)', // Info/Cyan transparent
                    borderColor: 'rgba(23, 162, 184, 0.8)', // Info/Cyan solid
                    pointBackgroundColor: 'rgba(23, 162, 184, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(23, 162, 184, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: { // Radial axis (values)
                        beginAtZero: true, min: 0, max: maxScale,
                        ticks: { stepSize: 1, backdropColor: 'transparent', color: '#6c757d' },
                        pointLabels: { font: { size: 13 }, color: '#495057' }, // Labels like "Teaching"
                        grid: { color: '#dee2e6' },
                        angleLines: { color: '#dee2e6' } // Lines from center
                    }
                },
                plugins: {
                    tooltip: {
                         callbacks: {
                              title: (tooltipItems) => tooltipItems[0]?.label ?? 'Category',
                              label: (context) => `Average: ${context.raw?.toFixed(2) ?? 'N/A'}`
                         }
                    },
                     legend: { display: false }
                },
                animation: { duration: 800, easing: 'easeOutCirc' }
            }
        });
    } catch (error) {
        console.error(`Chart.js error creating Radar Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart rendering failed: ${error.message}`);
    }
}


function createScatterPlot(elementId, data) {
     const canvas = document.getElementById(elementId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    clearErrorOnChart(elementId);
    destroyChartIfExists(elementId);

    if (!data || !Array.isArray(data.cgpa) || !Array.isArray(data.package) || data.cgpa.length !== data.package.length || data.cgpa.length === 0) {
        displayErrorOnChart(elementId, "Invalid or empty CGPA/Package data for Scatter Plot");
        return;
    }

    const scatterData = [];
    for (let i = 0; i < data.cgpa.length; i++) {
        const cgpa = parseFloat(data.cgpa[i]);
        const pkg = parseFloat(data.package[i]);
        if (Number.isFinite(cgpa) && Number.isFinite(pkg)) {
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
                         // suggestedMin: 5, // Adjust based on typical range
                         // suggestedMax: 10
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
       displayErrorOnChart(elementId, 'No valid Internal/External mark data found');
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
        displayErrorOnChart(elementId, `Insufficient data for ${label} trend (requires >= 2 points)`);
        return;
    }

    const sortedKeys = Object.keys(data).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    const labels = sortedKeys;
    const values = sortedKeys.map(key => Number.isFinite(parseFloat(data[key])) ? parseFloat(data[key]) : null);

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
        displayErrorOnChart(elementId, 'No data for Stacked Bar Chart');
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


// --- Main Execution ---
document.addEventListener('DOMContentLoaded', async () => {
    showLoading(); // Show loader right away
    setupTabNavigation();

    const dashboardData = await fetchDashboardData(); // Fetch data (handles loader hide/error)

    if (!dashboardData) {
        console.error("Dashboard data fetch failed. Cannot initialize dashboard.");
        // Global error is shown by fetch function. Optionally add chart-specific fallbacks:
        // displayErrorOnChart('gradeChart', 'Failed to load data');
        // displayErrorOnChart('placementRateChart', 'Failed to load data'); // etc.
        return;
    }

     clearGlobalErrorMessage(); // Clear if fetch was successful

    // Initialize each section, checking for the data key first
    if (dashboardData.exam_data) {
        initializeExamCharts(dashboardData.exam_data);
    } else {
        console.warn("Exam data missing from response. Initializing with error state.");
        initializeExamCharts({ error: 'Exam data not found in response' });
    }

    if (dashboardData.placement_data) {
        initializePlacementCharts(dashboardData.placement_data);
    } else {
         console.warn("Placement data missing from response. Initializing with error state.");
        initializePlacementCharts({ error: 'Placement data not found in response' });
    }

     if (dashboardData.faculty_data) {
        initializeFacultyCharts(dashboardData.faculty_data);
     } else {
        console.warn("Faculty data missing from response. Initializing with error state.");
        initializeFacultyCharts({ error: 'Faculty data not found in response' });
     }

    console.log("Dashboard initialized.");
});