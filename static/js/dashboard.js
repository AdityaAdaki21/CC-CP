// static/js/dashboard.js

// Chart.js defaults for consistent styling
Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#666'; // Default text color for charts

// --- Data Fetching and Error Handling ---

// Fetch data from the API endpoint
async function fetchDashboardData() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) {
            // Try to get error message from response body if possible
            let errorBody = 'Server responded with status ' + response.status;
            try {
                const errorJson = await response.json();
                errorBody = errorJson.error || errorJson.message || JSON.stringify(errorJson);
            } catch (e) { /* Ignore if body isn't valid JSON */ }
            console.error('Network response was not ok:', errorBody);
            throw new Error(errorBody);
        }
        const data = await response.json();
        console.log("Data fetched successfully:", data); // Log fetched data for debugging
        return data;
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Display a global error message
        displayGlobalErrorMessage(`Failed to load dashboard data: ${error.message}. Please check console and backend logs.`);
        return null; // Indicate failure
    }
}

// Function to display a global error message (e.g., in the header)
function displayGlobalErrorMessage(message) {
    const header = document.querySelector('.header');
    if (header) {
        let errorDiv = header.querySelector('.global-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'global-error';
            errorDiv.style.backgroundColor = '#dc3545'; // Red color for error
            errorDiv.style.color = 'white';
            errorDiv.style.padding = '10px';
            errorDiv.style.marginTop = '15px'; // Add some space from header content
            errorDiv.style.borderRadius = '5px';
            errorDiv.style.textAlign = 'center';
            errorDiv.style.fontSize = '0.9rem';
            // Insert after the h1 and p, before tab navigation if possible
            const tabNav = header.querySelector('.tab-navigation');
            if (tabNav) {
                 header.insertBefore(errorDiv, tabNav);
            } else {
                 header.appendChild(errorDiv);
            }

        }
        errorDiv.textContent = message;
    } else {
        // Fallback if header isn't found
        alert("Critical Error: " + message);
    }
}

// Helper function to display errors directly on chart canvases
function displayErrorOnChart(canvasId, message = 'Error loading data') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn(`Canvas element with ID ${canvasId} not found for error display.`);
        return;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // Destroy existing chart instance if it exists
        let chartInstance = Chart.getChart(canvasId);
        if (chartInstance) {
            chartInstance.destroy();
        }
        // Display error message centered on the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#dc3545'; // Error color
        ctx.font = "bold 14px 'Segoe UI'"; // Make error text noticeable
        // Wrap text if needed (basic wrapping)
        const maxWidth = canvas.width * 0.8;
        const words = message.split(' ');
        let line = '';
        let y = canvas.height / 2 - 10; // Start slightly above center if multiple lines
        const lineHeight = 18;

        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            let testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line.trim(), canvas.width / 2, y); // Trim trailing space
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
         ctx.fillText(line.trim(), canvas.width / 2, y); // Draw the last line, trimmed
        ctx.restore();
    }
}


// --- Initialization Functions ---

// Initialize Academic Performance Charts
function initializeExamCharts(examData) {
     if (!examData || examData.error) {
        const errorMsg = examData?.error || "Exam data unavailable";
        console.error("Exam data error:", errorMsg);
        // Display error on all relevant charts for this tab
        displayErrorOnChart('gradeChart', errorMsg);
        displayErrorOnChart('departmentPerformanceChart', errorMsg);
        displayErrorOnChart('topSubjectsChart', errorMsg);
        displayErrorOnChart('marksComparisonChart', errorMsg);
        displayErrorOnChart('semesterChart', errorMsg);
        // The 'subjectAnalysisChart' canvas was removed from HTML, so no error needed here.
        return; // Stop initialization for this section
    }

    // Grade Distribution
    if (examData.grade_distribution && Object.keys(examData.grade_distribution).length > 0) {
        createPieChart('gradeChart', examData.grade_distribution);
    } else {
        displayErrorOnChart('gradeChart', 'No Grade Distribution data');
    }

    // Department Performance
    if (examData.performance_by_department && Object.keys(examData.performance_by_department).length > 0) {
        createBarChart('departmentPerformanceChart', examData.performance_by_department, 'Average Marks', 100);
    } else {
         displayErrorOnChart('departmentPerformanceChart', 'No Department Performance data');
    }

    // Top Performing Subjects
    if (examData.subject_performance && Object.keys(examData.subject_performance).length > 0) {
        createHorizontalBarChart('topSubjectsChart', examData.subject_performance, 'Average Marks', 100);
    } else {
        displayErrorOnChart('topSubjectsChart', 'No Top Subject Performance data');
    }

    // Internal vs External Marks Comparison
    // Check if data exists and has the required keys (even if values are 0, chart can render that)
    if (examData.marks_comparison && typeof examData.marks_comparison.Internal !== 'undefined' && typeof examData.marks_comparison.External !== 'undefined') {
        // Check if data is explicitly null which we set in python on keyerror
         if (examData.marks_comparison.Internal === null || examData.marks_comparison.External === null) {
             displayErrorOnChart('marksComparisonChart', 'Internal/External exam types not found in data');
         } else {
             createMarksComparisonChart('marksComparisonChart', examData.marks_comparison);
         }
    } else {
        displayErrorOnChart('marksComparisonChart', 'Internal/External marks data structure incorrect');
    }

     // Semester Performance Trend
    if (examData.semester_performance && Object.keys(examData.semester_performance).length > 0) {
        createTrendChart('semesterChart', examData.semester_performance, 'Average Marks');
    } else {
        displayErrorOnChart('semesterChart', 'No Semester Performance data');
    }

    // 'subjectAnalysisChart' was removed from HTML - no action needed.
}

// Initialize Placement Statistics Charts
function initializePlacementCharts(placementData) {
    if (!placementData || placementData.error) {
        const errorMsg = placementData?.error || "Placement data unavailable";
        console.error("Placement data error:", errorMsg);
        // Display error on all relevant charts
        displayErrorOnChart('placementRateChart', errorMsg);
        displayErrorOnChart('packageChart', errorMsg);
        displayErrorOnChart('genderPlacementChart', errorMsg);
        displayErrorOnChart('cgpaPackageChart', errorMsg);
        displayErrorOnChart('companiesChart', errorMsg);
        displayErrorOnChart('skillsChart', errorMsg);
        return; // Stop initialization
    }

    // Placement Rate by Department
    if (placementData.placement_rate_by_dept && Object.keys(placementData.placement_rate_by_dept).length > 0) {
        createBarChart('placementRateChart', placementData.placement_rate_by_dept, 'Placement Rate', 1, true); // percent = true
    } else {
        displayErrorOnChart('placementRateChart', 'No Placement Rate data');
    }

    // Average Package by Department
    if (placementData.package_by_dept && Object.keys(placementData.package_by_dept).length > 0) {
        createBarChart('packageChart', placementData.package_by_dept, 'Average Package (LPA)', null);
    } else {
         displayErrorOnChart('packageChart', 'No Average Package data');
    }

    // Gender Placement Comparison
    if (placementData.gender_placement && typeof placementData.gender_placement === 'object' && Object.keys(placementData.gender_placement).length > 0 && !placementData.gender_placement.error) {
         // Check if there's actual count data inside the gender objects
         const hasGenderData = Object.values(placementData.gender_placement).some(counts => (counts['0'] || 0) + (counts['1'] || 0) > 0);
         if (hasGenderData) {
             createStackedBarChart('genderPlacementChart', placementData.gender_placement);
         } else {
             displayErrorOnChart('genderPlacementChart', 'No Gender Placement counts (all zero)');
         }
    } else {
        const specificError = placementData.gender_placement?.error ? `: ${placementData.gender_placement.error}` : ' available';
        displayErrorOnChart('genderPlacementChart', 'No Gender Placement data' + specificError);
    }

    // CGPA vs Package Correlation
    if (placementData.cgpa_package_data && placementData.cgpa_package_data.cgpa?.length > 0 && placementData.cgpa_package_data.package?.length > 0 && placementData.cgpa_package_data.cgpa.length === placementData.cgpa_package_data.package.length) {
        createScatterPlot('cgpaPackageChart', placementData.cgpa_package_data);
    } else {
         let errorMsg = 'No CGPA vs Package data';
         if (placementData.cgpa_package_data && (placementData.cgpa_package_data.cgpa?.length !== placementData.cgpa_package_data.package?.length)) {
             errorMsg = 'CGPA vs Package data length mismatch';
         }
         displayErrorOnChart('cgpaPackageChart', errorMsg);
    }

    // Top Recruiting Companies
    if (placementData.top_companies && Object.keys(placementData.top_companies).length > 0 && !placementData.top_companies.error) {
        createHorizontalBarChart('companiesChart', placementData.top_companies, 'Number of Placements', null);
    } else {
         const specificError = placementData.top_companies?.error ? `: ${placementData.top_companies.error}` : ' available';
         displayErrorOnChart('companiesChart', 'No Top Recruiting Companies data' + specificError);
    }

    // Most In-Demand Skills
    if (placementData.top_skills && Object.keys(placementData.top_skills).length > 0 && !placementData.top_skills.error) {
        createHorizontalBarChart('skillsChart', placementData.top_skills, 'Frequency', null);
    } else {
        const specificError = placementData.top_skills?.error ? `: ${placementData.top_skills.error}` : ' available';
        displayErrorOnChart('skillsChart', 'No Top Skills data' + specificError);
    }
}

// Initialize Faculty Evaluation Charts
function initializeFacultyCharts(facultyData) {
    if (!facultyData || facultyData.error) {
        const errorMsg = facultyData?.error || "Faculty data unavailable";
        console.error("Faculty data error:", errorMsg);
        displayErrorOnChart('ratingsChart', errorMsg);
        displayErrorOnChart('deptRatingsChart', errorMsg);
        displayErrorOnChart('facultySemesterChart', errorMsg);
        displayErrorOnChart('ratingTrendsChart', errorMsg); // Keep error display target
        displayErrorOnChart('topFacultyChart', errorMsg);
        displayErrorOnChart('courseRatingChart', errorMsg);
        return; // Stop initialization
    }

    // Average Ratings by Category (Radar Chart)
    if (facultyData.avg_ratings && Object.keys(facultyData.avg_ratings).length > 0) {
        createRadarChart('ratingsChart', facultyData.avg_ratings);
    } else {
        displayErrorOnChart('ratingsChart', 'No Average Faculty Rating data');
    }

    // Department Teaching Ratings
    if (facultyData.dept_teaching_ratings && Object.keys(facultyData.dept_teaching_ratings).length > 0) {
        createBarChart('deptRatingsChart', facultyData.dept_teaching_ratings, 'Average Teaching Rating', 5);
    } else {
        displayErrorOnChart('deptRatingsChart', 'No Dept Teaching Rating data');
    }

    // Semester Comparison (Rating Trend) - Assuming 'semester_ratings' is overall avg per semester
    if (facultyData.semester_ratings && Object.keys(facultyData.semester_ratings).length > 0) {
         createTrendChart('facultySemesterChart', facultyData.semester_ratings, 'Average Rating'); // Use simple trend
    } else {
         displayErrorOnChart('facultySemesterChart', 'No Semester Rating data');
    }

    // *** MODIFICATION START ***
    // Faculty Rating Trends (Yearly) - Use createTrendChart with the new data key
    if (facultyData.yearly_average_trend && Object.keys(facultyData.yearly_average_trend).length > 0) {
        // Use the existing createTrendChart function
        createTrendChart('ratingTrendsChart', facultyData.yearly_average_trend, 'Overall Average Rating');
    } else {
        displayErrorOnChart('ratingTrendsChart', 'No Yearly Average Rating Trend data available');
    }
    // *** MODIFICATION END ***


    // Top Rated Faculty
    if (facultyData.top_faculty && Object.keys(facultyData.top_faculty).length > 0) {
        createHorizontalBarChart('topFacultyChart', facultyData.top_faculty, 'Average Rating', 5);
    } else {
        displayErrorOnChart('topFacultyChart', 'No Top Rated Faculty data');
    }

    // Course Rating Comparison
    if (facultyData.course_ratings && Object.keys(facultyData.course_ratings).length > 0) {
        createHorizontalBarChart('courseRatingChart', facultyData.course_ratings, 'Average Rating', 5);
    } else {
        displayErrorOnChart('courseRatingChart', 'No Course Rating data');
    }
}

// --- Tab Navigation ---

// Setup event listeners for tab buttons
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Pre-select the first tab on initial load
    if (tabButtons.length > 0 && tabContents.length > 0) {
        // Ensure only the first elements get the active class initially
         tabButtons.forEach((btn, index) => btn.classList.toggle('active', index === 0));
         tabContents.forEach((content, index) => content.classList.toggle('active', index === 0));
    }


    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Extract tabId from the onclick attribute (safer way)
            const onclickAttr = button.getAttribute('onclick');
            const match = onclickAttr ? onclickAttr.match(/showTab\('([^']+)'\)/) : null;
            const targetTabId = match ? match[1] : null;
            // const targetTabId = button.getAttribute('onclick')?.match(/'([^']+)'/)?.[1]; // Alternative shorter syntax

            if (targetTabId) {
                showTab(targetTabId);
            } else {
                console.error("Could not determine target tab ID for button:", button);
            }
        });
    });
}

// Function to show a specific tab and hide others
function showTab(tabId) {
    // Remove active class from all tabs and buttons
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // Add active class to the selected tab and its corresponding button
    const targetTab = document.getElementById(tabId);
    // Find button more reliably by checking its onclick attribute content
    const targetButton = Array.from(document.querySelectorAll('.tab-button')).find(
        button => button.getAttribute('onclick') === `showTab('${tabId}')`
    );
    // const targetButton = document.querySelector(`[onclick="showTab('${tabId}')"]`); // Simpler query selector


    if (targetTab) {
        targetTab.classList.add('active');
        console.log(`Activated tab: ${tabId}`); // Debug log
    } else {
         console.error(`Tab content with ID ${tabId} not found.`);
    }

    if (targetButton) {
        targetButton.classList.add('active');
        console.log(`Activated button for tab: ${tabId}`); // Debug log
    } else {
        console.error(`Tab button for tab ID ${tabId} not found.`);
    }
}


// --- Reusable Chart Creation Functions ---

function createBarChart(elementId, data, label, maxValue, percent = false) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) {
        console.error(`Canvas context not found for ID: ${elementId}`);
        return;
    }
    // Destroy existing chart instance if it exists
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    // Sort data by label for consistent order if needed (optional)
    // const sortedKeys = Object.keys(data).sort();
    // const sortedValues = sortedKeys.map(key => data[key]);

    try {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(data), // Use original keys for labels
                datasets: [{
                    label: label,
                    data: Object.values(data), // Use original values
                    backgroundColor: '#3a86ff', // Primary blue
                    borderColor: '#3a86ff',
                    borderWidth: 1,
                    borderRadius: 5, // Rounded corners
                    hoverBackgroundColor: '#2667ff' // Darker blue on hover
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // Often cleaner without legend for single dataset
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)', // Darker tooltip
                        titleFont: { weight: 'bold' },
                        callbacks: {
                            label: function(context) {
                                let value = context.raw;
                                if (typeof value !== 'number') return ''; // Handle non-numeric data gracefully
                                return percent ? `${(value * 100).toFixed(1)}%` : value.toLocaleString(); // Format numbers if large
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: maxValue, // Optional max value (null or undefined lets Chart.js decide)
                        grid: {
                            color: '#e9ecef' // Lighter grid lines
                        },
                        ticks: {
                            callback: function(value) {
                                if (typeof value !== 'number') return '';
                                return percent ? `${(value * 100).toFixed(0)}%` : value.toLocaleString();
                            },
                            color: '#495057' // Darker tick labels
                        }
                    },
                    x: {
                         grid: {
                             display: false // Hide vertical grid lines
                         },
                         ticks: {
                             color: '#495057'
                         }
                    }
                },
                 // Add animation object for smoother loading (optional)
                 animation: {
                    duration: 800,
                    easing: 'easeOutQuart'
                }
            }
        });
    } catch (error) {
        console.error(`Chart.js error creating Bar Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart creation failed: ${error.message}`);
    }
}

function createHorizontalBarChart(elementId, data, label, maxValue) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
     if (!ctx) {
        console.error(`Canvas context not found for ID: ${elementId}`);
        return;
    }
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

     // Sort data by value (descending) for better readability of top items (optional)
     const sortedEntries = Object.entries(data).sort(([, a], [, b]) => b - a);
     const sortedLabels = sortedEntries.map(([key]) => key);
     const sortedValues = sortedEntries.map(([, value]) => value);


    try {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedLabels, // Use sorted labels
                datasets: [{
                    label: label,
                    data: sortedValues, // Use sorted values
                    backgroundColor: '#4ecdc4', // Teal color
                    borderColor: '#4ecdc4',
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                indexAxis: 'y', // Make it horizontal
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                     tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { weight: 'bold' },
                        callbacks: {
                            label: function(context) {
                                 let value = context.raw;
                                 if (typeof value !== 'number') return '';
                                 return `${label}: ${value.toLocaleString()}`; // Add label context
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: maxValue, // Optional max
                        grid: {
                            color: '#e9ecef'
                        },
                         ticks: {
                             color: '#495057'
                         }
                    },
                    y: {
                         grid: {
                             display: false
                         },
                         ticks: {
                             color: '#495057'
                         }
                    }
                },
                animation: {
                    duration: 800,
                    easing: 'easeOutQuart'
                }
            }
        });
     } catch (error) {
        console.error(`Chart.js error creating Horizontal Bar Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart creation failed: ${error.message}`);
    }
}

function createPieChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) {
        console.error(`Canvas context not found for ID: ${elementId}`);
        return;
    }
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    // Enhanced color palette
    const colorPalette = ['#3a86ff', '#ffbe0b', '#fb5607', '#8338ec', '#4ecdc4', '#ff6b6b', '#fca311', '#14213d', '#6a0dad', '#ced4da']; // Added gray fallback

     // Ensure enough colors for the data, repeat if necessary
    const backgroundColors = Object.keys(data).map((_, index) => colorPalette[index % colorPalette.length]);

    try {
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    data: Object.values(data),
                    backgroundColor: backgroundColors, // Use generated colors
                    borderColor: '#ffffff', // White border for separation
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right', // Better for limited height
                        labels: {
                            boxWidth: 12,
                            padding: 15 // Spacing for legend items
                        }
                    },
                     tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { weight: 'bold' },
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                let value = context.raw;
                                if (typeof value !== 'number') return `${label}: N/A`;

                                let total = context.chart.getDatasetMeta(0)?.total; // Safer access
                                let percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                                return `${label}: ${value.toLocaleString()} (${percentage})`;
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000, // Longer for pie/doughnut
                    easing: 'easeOutBounce'
                }
            }
        });
    } catch (error) {
        console.error(`Chart.js error creating Pie Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart creation failed: ${error.message}`);
    }
}

// createDoughnutChart function - likely not used based on current HTML, but keep if needed
function createDoughnutChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
     if (!ctx) {
        console.error(`Canvas context not found for ID: ${elementId}`);
        return;
    }
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    const colorPalette = ['#ff6b6b', '#4ecdc4', '#ffbe0b', '#3a86ff', '#8338ec', '#fb5607', '#fca311', '#14213d', '#ced4da'];
    const backgroundColors = Object.keys(data).map((_, index) => colorPalette[index % colorPalette.length]);

    try {
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    data: Object.values(data),
                    backgroundColor: backgroundColors,
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 8 // Slightly enlarge slice on hover
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%', // Adjust doughnut thickness
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 15
                        }
                    },
                    tooltip: {
                         backgroundColor: 'rgba(0, 0, 0, 0.8)',
                         titleFont: { weight: 'bold' },
                        callbacks: { // Similar percentage calculation as Pie chart
                            label: function(context) {
                                let label = context.label || '';
                                let value = context.raw;
                                 if (typeof value !== 'number') return `${label}: N/A`;
                                let total = context.chart.getDatasetMeta(0)?.total;
                                let percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                                return `${label}: ${value.toLocaleString()} (${percentage})`;
                            }
                        }
                    }
                },
                 animation: {
                    duration: 1000,
                    easing: 'easeOutBounce'
                }
            }
        });
    } catch (error) {
        console.error(`Chart.js error creating Doughnut Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart creation failed: ${error.message}`);
    }
}

// Helper function to format rating labels (e.g., "Rating_Teaching" -> "Teaching")
function formatRatingLabel(key) {
    return key.replace(/^Rating_/i, '').replace(/_/g, ' '); // Make it more readable
}

function createRadarChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) {
        console.error(`Canvas context not found for ID: ${elementId}`);
        return;
    }
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    const labels = Object.keys(data).map(key => formatRatingLabel(key));
    const values = Object.values(data).map(v => typeof v === 'number' ? v : 0); // Default non-numeric to 0

     if (labels.length === 0 || values.length === 0) {
         displayErrorOnChart(elementId, 'No valid data for Radar Chart');
         return;
     }

    try {
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Average Rating',
                    data: values,
                    backgroundColor: 'rgba(58, 134, 255, 0.2)', // Light blue fill
                    borderColor: 'rgba(58, 134, 255, 0.8)', // Solid blue line
                    pointBackgroundColor: 'rgba(58, 134, 255, 1)', // Solid blue points
                    pointBorderColor: '#fff', // White border on points
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(58, 134, 255, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: { // Radial axis configuration
                        beginAtZero: true,
                        min: 0,
                        max: 5, // Assuming a 5-point rating scale - ADJUST IF NEEDED
                        ticks: {
                            stepSize: 1,
                            backdropColor: 'rgba(0, 0, 0, 0)', // Transparent background behind ticks
                            color: '#495057'
                        },
                        pointLabels: { // Labels like "Teaching", "Clarity"
                            font: {
                                size: 13 // Slightly larger point labels
                            },
                            color: '#333'
                        },
                        grid: {
                            color: '#ced4da' // Lighter grid lines
                        },
                        angleLines: {
                             color: '#ced4da' // Lines from center to points
                        }
                    }
                },
                 plugins: {
                    tooltip: {
                         backgroundColor: 'rgba(0, 0, 0, 0.8)',
                         titleFont: { weight: 'bold' },
                        callbacks: {
                            label: function(context) {
                                return `Rating: ${context.raw?.toFixed(2) ?? 'N/A'}`; // Show rating with 2 decimals safely
                            }
                        }
                    },
                    legend: {
                        display: false // Hide legend if only one dataset
                    }
                },
                 animation: { // Specific animation for radar
                    duration: 900,
                    easing: 'easeOutCirc'
                }
            }
        });
    } catch (error) {
        console.error(`Chart.js error creating Radar Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart creation failed: ${error.message}`);
    }
}

function createScatterPlot(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
     if (!ctx) {
        console.error(`Canvas context not found for ID: ${elementId}`);
        return;
    }
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    // Create dataset from CGPA and package arrays, filtering invalid entries
    const scatterData = [];
    // Add rigorous checks for data type and length
    if (data && Array.isArray(data.cgpa) && Array.isArray(data.package) && data.cgpa.length === data.package.length) {
        for (let i = 0; i < data.cgpa.length; i++) {
            // Ensure both cgpa and package are valid finite numbers
            const cgpa = parseFloat(data.cgpa[i]);
            const pkg = parseFloat(data.package[i]);
            if (Number.isFinite(cgpa) && Number.isFinite(pkg)) {
                scatterData.push({
                    x: cgpa,
                    y: pkg
                });
            }
        }
    } else {
         console.error("Invalid data format for scatter plot:", data);
         displayErrorOnChart(elementId, "Invalid/mismatched CGPA/Package data");
         return;
    }

     if (scatterData.length === 0) {
         displayErrorOnChart(elementId, "No valid data points for Scatter Plot");
         return;
     }

    try {
        new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'CGPA vs Package',
                    data: scatterData,
                    backgroundColor: 'rgba(58, 134, 255, 0.6)', // Semi-transparent blue points
                    borderColor: 'rgba(58, 134, 255, 0.8)',
                    pointRadius: 5, // Default point size
                    pointHoverRadius: 7 // Larger points on hover
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear', // Ensure linear scale
                        position: 'bottom',
                        title: {
                            display: true,
                            text: 'CGPA',
                            font: { weight: 'bold' },
                            color: '#333'
                        },
                        grid: { color: '#e9ecef' },
                        ticks: { color: '#495057' },
                        // Let Chart.js determine min/max unless you have specific needs
                    },
                    y: {
                         type: 'linear',
                        title: {
                            display: true,
                            text: 'Package (LPA)',
                            font: { weight: 'bold' },
                            color: '#333'
                        },
                        beginAtZero: true, // Packages usually start at 0
                        grid: { color: '#e9ecef' },
                        ticks: {
                            color: '#495057',
                            callback: function(value) { return `₹${value.toLocaleString()} LPA`; } // Add currency/unit
                         }
                    }
                },
                plugins: {
                     legend: {
                        display: false // Usually not needed for single dataset scatter
                     },
                    tooltip: {
                         backgroundColor: 'rgba(0, 0, 0, 0.8)',
                         titleFont: { weight: 'bold' },
                        callbacks: {
                            label: function(context) {
                                // Check if parsed values exist before formatting
                                const xVal = context.parsed?.x;
                                const yVal = context.parsed?.y;
                                if (typeof xVal === 'number' && typeof yVal === 'number') {
                                    return `CGPA: ${xVal.toFixed(2)}, Package: ₹${yVal.toFixed(2)} LPA`;
                                }
                                return 'Invalid data point';
                            }
                        }
                    }
                }
                // No specific animation usually needed for scatter, default fade is fine
            }
        });
     } catch (error) {
        console.error(`Chart.js error creating Scatter Plot (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart creation failed: ${error.message}`);
    }
}

function createMarksComparisonChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
     if (!ctx) {
        console.error(`Canvas context not found for ID: ${elementId}`);
        return;
    }
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    // Validate data structure and types
    if (!data || typeof data.Internal !== 'number' || typeof data.External !== 'number') {
         // Python now sends null if keys were missing, so we handle that case specifically
         if (data && data.Internal === null && data.External === null) {
             displayErrorOnChart(elementId, "Internal/External exam type data not found");
         } else {
            console.error("Invalid data for Marks Comparison chart:", data);
            displayErrorOnChart(elementId, "Invalid marks comparison data received");
         }
         return;
    }

    try {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Average Marks'], // Single category label
                datasets: [
                    {
                        label: 'Internal Marks',
                        data: [data.Internal], // Expecting a number
                        backgroundColor: '#4ecdc4', // Teal
                        borderColor: '#4ecdc4',
                        borderWidth: 1,
                        borderRadius: 5
                    },
                    {
                        label: 'External Marks',
                        data: [data.External], // Expecting a number
                        backgroundColor: '#ff6b6b', // Coral
                        borderColor: '#ff6b6b',
                        borderWidth: 1,
                        borderRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top', // Show legend clearly
                    },
                     tooltip: {
                         backgroundColor: 'rgba(0, 0, 0, 0.8)',
                         titleFont: { weight: 'bold' },
                         callbacks: {
                             title: () => null, // No title needed for single category
                             label: function(context) {
                                  let rawValue = context.raw;
                                  if (typeof rawValue === 'number') {
                                       return `${context.dataset.label}: ${rawValue.toFixed(2)}`;
                                  }
                                  return `${context.dataset.label}: N/A`;
                             }
                         }
                     }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Average Marks',
                            font: { weight: 'bold' },
                            color: '#333'
                        },
                         grid: { color: '#e9ecef' },
                         ticks: { color: '#495057' }
                    },
                     x: {
                         grid: { display: false },
                         ticks: { display: false } // Hide x-axis labels if only one category
                     }
                },
                animation: {
                    duration: 800,
                    easing: 'easeOutQuart'
                }
            }
        });
     } catch (error) {
        console.error(`Chart.js error creating Marks Comparison Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart creation failed: ${error.message}`);
    }
}

function createTrendChart(elementId, data, label) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
     if (!ctx) {
        console.error(`Canvas context not found for ID: ${elementId}`);
        return;
    }
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    // Ensure data is an object and not empty
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        displayErrorOnChart(elementId, `No data available for ${label} trend`);
        return;
    }


    // Attempt to sort keys chronologically (works for simple numbers/strings)
    const sortedKeys = Object.keys(data).sort((a, b) => {
         // Improved sort: Treat as numbers if possible, otherwise string compare
         const numA = parseFloat(a);
         const numB = parseFloat(b);
         if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
         return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    });
    const sortedLabels = sortedKeys;
    // Ensure values are numbers, default to null/0 if not? Chart.js can handle gaps with 'spanGaps'
    const sortedData = sortedKeys.map(key => {
        const val = parseFloat(data[key]);
        return Number.isFinite(val) ? val : null; // Use null for gaps
    });

    // Filter out purely null data points to avoid empty chart errors
    const validDataPoints = sortedData.filter(d => d !== null);
     if (validDataPoints.length === 0) {
         displayErrorOnChart(elementId, `No valid numeric data for ${label} trend`);
         return;
     }

    try {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedLabels,
                datasets: [{
                    label: label,
                    data: sortedData, // Data with potential nulls for gaps
                    spanGaps: true, // Connect line across null points
                    backgroundColor: 'rgba(58, 134, 255, 0.1)', // Light fill under line
                    borderColor: 'rgba(58, 134, 255, 1)', // Solid line color
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(58, 134, 255, 1)', // Point color
                    pointRadius: 4, // Visible points
                    pointHoverRadius: 6,
                    tension: 0.1 // Slight curve to the line
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                 plugins: {
                    legend: {
                        display: !!label && label.length > 0 // Display legend only if label provided
                    },
                     tooltip: {
                         backgroundColor: 'rgba(0, 0, 0, 0.8)',
                         titleFont: { weight: 'bold' },
                         intersect: false, // Show tooltip when hovering near line
                         mode: 'index', // Show tooltips for all points at that index
                         callbacks: {
                             label: function(context) {
                                  let val = context.raw;
                                  return `${label}: ${typeof val === 'number' ? val.toFixed(2) : 'N/A'}`;
                             }
                         }
                     }
                },
                scales: {
                    y: {
                        beginAtZero: false, // Trend might not start at zero
                         grid: { color: '#e9ecef' },
                         ticks: { color: '#495057' }
                    },
                    x: {
                         grid: { display: false },
                         ticks: { color: '#495057' }
                    }
                },
                 animation: {
                    duration: 900,
                    easing: 'easeOutCubic'
                }
            }
        });
     } catch (error) {
        console.error(`Chart.js error creating Trend Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart creation failed: ${error.message}`);
    }
}

function createStackedBarChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) {
        console.error(`Canvas context not found for ID: ${elementId}`);
        return;
    }
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    // Ensure data is an object and not empty
     if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        displayErrorOnChart(elementId, 'No data available for Stacked Bar Chart');
        return;
    }

    // Extract gender categories dynamically
    const categories = Object.keys(data); // E.g., ['Male', 'Female', 'Other']

    // Define dataset labels and corresponding keys in the nested data
    const datasetConfig = [
         { label: 'Placed', key: '1', color: '#4ecdc4', radius: { topLeft: 5, topRight: 5 } }, // Teal
         { label: 'Not Placed', key: '0', color: '#ff6b6b', radius: { bottomLeft: 5, bottomRight: 5 } } // Coral
    ];


    // Create datasets, handling potential missing keys ('0' or '1') gracefully
    const datasets = datasetConfig.map(config => ({
        label: config.label,
        // Map data ensuring 0 if the key (e.g., '1') is missing for a category (e.g., 'Male')
        data: categories.map(category => data[category]?.[config.key] || 0),
        backgroundColor: config.color,
        borderColor: config.color,
        borderWidth: 1,
        borderRadius: config.radius
    }));

    try {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categories, // Gender labels
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                 plugins: {
                    legend: {
                        position: 'top',
                    },
                     tooltip: {
                         backgroundColor: 'rgba(0, 0, 0, 0.8)',
                         titleFont: { weight: 'bold' },
                         mode: 'index', // Show both tooltips for the category
                          callbacks: {
                             label: function(context) {
                                 let val = context.raw;
                                  return `${context.dataset.label}: ${typeof val === 'number' ? val.toLocaleString() : 'N/A'}`;
                             }
                         }
                     }
                },
                scales: {
                    x: {
                        stacked: true, // Stack bars horizontally (along category axis)
                        grid: { display: false },
                        ticks: { color: '#495057' }
                    },
                    y: {
                        stacked: true, // Stack bars vertically (along value axis)
                        beginAtZero: true,
                        title: {
                           display: true,
                           text: 'Number of Students',
                           font: { weight: 'normal', size: 12 },
                           color: '#666',
                           padding: {top: 0, bottom: 10}
                        },
                        grid: { color: '#e9ecef' },
                        ticks: { color: '#495057' }
                    }
                },
                 animation: {
                    duration: 800,
                    easing: 'easeOutQuart'
                }
            }
        });
     } catch (error) {
        console.error(`Chart.js error creating Stacked Bar Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart creation failed: ${error.message}`);
    }
}

function createMultiLineChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) {
        console.error(`Canvas context not found for ID: ${elementId}`);
        return;
    }
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

     // Ensure data is an object and not empty
     if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        displayErrorOnChart(elementId, 'No yearly trend data available');
        return;
    }

    // Extract years and sort numerically
    const years = Object.keys(data).sort((a, b) => parseFloat(a) - parseFloat(b));
    if (years.length === 0) {
         displayErrorOnChart(elementId, 'No years found in trend data');
         return;
    }

    // Get categories dynamically from the first year's data, assuming structure is consistent
    // Need to handle case where first year might have no data
    let categories = [];
    for (const year of years) {
        if (data[year] && typeof data[year] === 'object' && Object.keys(data[year]).length > 0) {
            categories = Object.keys(data[year]);
            break; // Found categories from the first valid year
        }
    }

    if (categories.length === 0) {
         displayErrorOnChart(elementId, 'No rating categories found in yearly trend data');
         return;
    }

    // Define a color palette for different rating types
     const colorPalette = {
        'Rating_Teaching':    { border: '#3a86ff', background: 'rgba(58, 134, 255, 0.1)' }, // Blue
        'Rating_Engagement':  { border: '#ffbe0b', background: 'rgba(255, 190, 11, 0.1)' }, // Yellow
        'Rating_Clarity':     { border: '#4ecdc4', background: 'rgba(78, 205, 196, 0.1)' }, // Teal
        'Rating_Punctuality': { border: '#ff6b6b', background: 'rgba(255, 107, 107, 0.1)' }, // Coral
        'Rating_Default':     { border: '#8338ec', background: 'rgba(131, 56, 236, 0.1)'}, // Purple fallback
        'default':            { border: '#adb5bd', background: 'rgba(173, 181, 189, 0.1)'}  // Gray fallback
    };

    // Create datasets for each rating category
    const datasets = categories.map((category, index) => {
        // Get value for each year, defaulting to null for gaps if year/category missing
        const values = years.map(year => {
             const val = data[year]?.[category];
             // Ensure value is numeric or null
             return (typeof val === 'number' && Number.isFinite(val)) ? val : null;
        });

        const cleanCategoryKey = category.replace(/ /g, '_'); // Ensure consistent key for palette lookup
        const colors = colorPalette[cleanCategoryKey] || colorPalette['Rating_Default'] || colorPalette['default']; // Palette lookup strategy
        return {
            label: formatRatingLabel(category), // Use helper to clean label for display
            data: values,
            borderColor: colors.border,
            backgroundColor: colors.background,
            borderWidth: 2,
            fill: false, // Keep fill subtle or off for multi-line clarity
            tension: 0.1, // Slight curve
             pointRadius: 3,
             pointHoverRadius: 5,
             pointBackgroundColor: colors.border,
             spanGaps: true // Connect line over null data points
        };
    });

     // Check if all datasets have only null values
     const allDataIsNull = datasets.every(ds => ds.data.every(d => d === null));
     if (allDataIsNull) {
         displayErrorOnChart(elementId, 'No valid numeric rating data found for trends');
         return;
     }


    try {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top', // Show legend for multiple lines
                        labels: {
                            usePointStyle: true, // Use point style in legend
                            boxWidth: 8,
                            padding: 15
                        }
                    },
                     tooltip: {
                         backgroundColor: 'rgba(0, 0, 0, 0.8)',
                         titleFont: { weight: 'bold' },
                         intersect: false,
                         mode: 'index', // Show all tooltips for the year
                         callbacks: {
                             // Title callback can show the year
                             title: function(tooltipItems) {
                                 return `Year: ${tooltipItems[0]?.label || ''}`;
                             },
                             label: function(context) {
                                 let label = context.dataset.label || '';
                                 let value = context.raw;
                                  return `${label}: ${typeof value === 'number' ? value.toFixed(2) : 'N/A'}`; // Handle null/undefined
                             }
                         }
                     }
                },
                scales: {
                    y: {
                        beginAtZero: false, // Ratings likely don't start at 0
                        min: 0, // Set min if appropriate (e.g., rating scales, typically 1 or 0)
                        max: 5, // Set max if appropriate (e.g., rating scale 5)
                        title: {
                            display: true,
                            text: 'Average Rating', // Generic Y-axis title
                            font: { weight: 'bold' },
                            color: '#333'
                        },
                        grid: { color: '#e9ecef' },
                        ticks: {
                            color: '#495057',
                            stepSize: 1 // Adjust step size if needed for rating scale
                        }
                    },
                    x: {
                         title: {
                            display: true,
                            text: 'Year',
                            font: { weight: 'bold' },
                            color: '#333'
                        },
                        grid: { display: false },
                        ticks: { color: '#495057' }
                    }
                },
                 interaction: { // Improve hover interaction
                    mode: 'index',
                    intersect: false,
                },
                animation: {
                    duration: 900,
                    easing: 'easeOutCubic'
                }
            }
        });
    } catch (error) {
        console.error(`Chart.js error creating Multi-Line Chart (${elementId}):`, error);
        displayErrorOnChart(elementId, `Chart creation failed: ${error.message}`);
    }
}


// --- Main Execution ---

// Initialize charts when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Fetch data first
    const dashboardData = await fetchDashboardData();

    // Setup tab navigation regardless of data fetching success
    setupTabNavigation();

    // If data fetching failed, `dashboardData` will be null, and a global error message was shown
    if (!dashboardData) {
        console.error("Dashboard data could not be loaded. Chart initialization skipped.");
        // Optionally explicitly display errors on all charts using displayErrorOnChart for each tab
        // This might be redundant if the global message is clear enough. Example:
         displayErrorOnChart('gradeChart', 'Failed to load data');
         displayErrorOnChart('placementRateChart', 'Failed to load data');
         displayErrorOnChart('ratingsChart', 'Failed to load data');
         // ... add more for key charts on each tab if desired
        return; // Stop further execution
    }

    // Clear any global error message if data was loaded successfully
    const globalError = document.querySelector('.global-error');
    if (globalError) {
        globalError.remove();
    }

    // Initialize charts for each section using the fetched data
    // Add checks to ensure data sub-objects exist before calling initialization
     if (dashboardData.exam_data) {
        initializeExamCharts(dashboardData.exam_data);
     } else {
         console.warn("Exam data object missing in fetched data. Skipping exam charts.");
         // Display errors on exam charts if needed
         displayErrorOnChart('gradeChart', 'Exam data missing');
         // ...
     }

    if (dashboardData.placement_data) {
        initializePlacementCharts(dashboardData.placement_data);
    } else {
         console.warn("Placement data object missing in fetched data. Skipping placement charts.");
         // Display errors on placement charts if needed
         displayErrorOnChart('placementRateChart', 'Placement data missing');
         // ...
    }

     if (dashboardData.faculty_data) {
        initializeFacultyCharts(dashboardData.faculty_data);
     } else {
        console.warn("Faculty data object missing in fetched data. Skipping faculty charts.");
         // Display errors on faculty charts if needed
         displayErrorOnChart('ratingsChart', 'Faculty data missing');
          // ...
     }

});