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
                ctx.fillText(line, canvas.width / 2, y);
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
         ctx.fillText(line, canvas.width / 2, y); // Draw the last line
        ctx.restore();
    }
}


// --- Initialization Functions ---

// Initialize Academic Performance Charts
function initializeExamCharts(examData) {
     if (!examData || examData.error) {
        const errorMsg = examData?.error || "Exam data unavailable";
        console.error("Exam data error:", errorMsg);
        // Display error on all relevant charts
        displayErrorOnChart('gradeChart', errorMsg);
        displayErrorOnChart('departmentPerformanceChart', errorMsg);
        displayErrorOnChart('topSubjectsChart', errorMsg);
        displayErrorOnChart('marksComparisonChart', errorMsg);
        displayErrorOnChart('semesterChart', errorMsg);
        // Optionally handle 'subjectAnalysisChart' if it exists
        // displayErrorOnChart('subjectAnalysisChart', errorMsg);
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
    if (examData.marks_comparison && Object.keys(examData.marks_comparison).length === 2) { // Expects 'Internal' and 'External'
        createMarksComparisonChart('marksComparisonChart', examData.marks_comparison);
    } else {
        displayErrorOnChart('marksComparisonChart', 'No Marks Comparison data');
    }

     // Semester Performance Trend
    if (examData.semester_performance && Object.keys(examData.semester_performance).length > 0) {
        createTrendChart('semesterChart', examData.semester_performance, 'Average Marks');
    } else {
        displayErrorOnChart('semesterChart', 'No Semester Performance data');
    }

     // Handle 'subjectAnalysisChart' - REMOVED from HTML in recommendation, so no code needed here
     // If you kept it and added data in app.py, add the chart call here.
     // Example:
     // if (examData.some_subject_analysis_data) {
     //     createSomeChartType('subjectAnalysisChart', examData.some_subject_analysis_data, ...);
     // } else {
     //     displayErrorOnChart('subjectAnalysisChart', 'No Subject Analysis data');
     // }
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
    if (placementData.gender_placement && Object.keys(placementData.gender_placement).length > 0) {
         // Check if there's actual data inside the gender objects
         const hasGenderData = Object.values(placementData.gender_placement).some(counts => (counts['0'] || 0) + (counts['1'] || 0) > 0);
         if (hasGenderData) {
             createStackedBarChart('genderPlacementChart', placementData.gender_placement);
         } else {
             displayErrorOnChart('genderPlacementChart', 'No Gender Placement counts');
         }
    } else {
        displayErrorOnChart('genderPlacementChart', 'No Gender Placement data available');
    }

    // CGPA vs Package Correlation
    if (placementData.cgpa_package_data && placementData.cgpa_package_data.cgpa?.length > 0 && placementData.cgpa_package_data.package?.length > 0) {
        createScatterPlot('cgpaPackageChart', placementData.cgpa_package_data);
    } else {
        displayErrorOnChart('cgpaPackageChart', 'No CGPA vs Package data');
    }

    // Top Recruiting Companies
    if (placementData.top_companies && Object.keys(placementData.top_companies).length > 0) {
        createHorizontalBarChart('companiesChart', placementData.top_companies, 'Number of Placements', null);
    } else {
         displayErrorOnChart('companiesChart', 'No Top Recruiting Companies data');
    }

    // Most In-Demand Skills
    if (placementData.top_skills && Object.keys(placementData.top_skills).length > 0) {
        createHorizontalBarChart('skillsChart', placementData.top_skills, 'Frequency', null);
    } else {
         displayErrorOnChart('skillsChart', 'No Top Skills data');
    }
}

// Initialize Faculty Evaluation Charts
function initializeFacultyCharts(facultyData) {
    if (!facultyData || facultyData.error) {
        const errorMsg = facultyData?.error || "Faculty data unavailable";
        console.error("Faculty data error:", errorMsg);
        // Display error on all relevant charts
        displayErrorOnChart('ratingsChart', errorMsg);
        displayErrorOnChart('deptRatingsChart', errorMsg);
        displayErrorOnChart('facultySemesterChart', errorMsg);
        displayErrorOnChart('ratingTrendsChart', errorMsg);
        displayErrorOnChart('topFacultyChart', errorMsg);
        displayErrorOnChart('courseRatingChart', errorMsg);
        return; // Stop initialization
    }

    // Average Ratings by Category (Radar Chart)
    if (facultyData.avg_ratings && Object.keys(facultyData.avg_ratings).length > 0) {
        createRadarChart('ratingsChart', facultyData.avg_ratings); // Use the correct key: avg_ratings
    } else {
        displayErrorOnChart('ratingsChart', 'No Average Faculty Rating data');
    }

    // Department Teaching Ratings
    if (facultyData.dept_teaching_ratings && Object.keys(facultyData.dept_teaching_ratings).length > 0) {
        createBarChart('deptRatingsChart', facultyData.dept_teaching_ratings, 'Teaching Rating', 5);
    } else {
        displayErrorOnChart('deptRatingsChart', 'No Dept Teaching Rating data');
    }

    // Semester Comparison (Teaching Rating Trend)
    if (facultyData.semester_ratings && Object.keys(facultyData.semester_ratings).length > 0) {
         createTrendChart('facultySemesterChart', facultyData.semester_ratings, 'Average Teaching Rating');
    } else {
         displayErrorOnChart('facultySemesterChart', 'No Semester Rating data');
    }

    // Faculty Rating Trends (Year-wise Multi-Line)
    if (facultyData.year_ratings && Object.keys(facultyData.year_ratings).length > 0) {
        // Ensure there's actually data within the years
        const hasTrendData = Object.values(facultyData.year_ratings).some(yearData => Object.keys(yearData).length > 0);
        if (hasTrendData) {
             createMultiLineChart('ratingTrendsChart', facultyData.year_ratings);
        } else {
            displayErrorOnChart('ratingTrendsChart', 'No Rating Trend counts');
        }
    } else {
        displayErrorOnChart('ratingTrendsChart', 'No Rating Trend data available');
    }

    // Top Rated Faculty
    if (facultyData.top_faculty && Object.keys(facultyData.top_faculty).length > 0) {
        createHorizontalBarChart('topFacultyChart', facultyData.top_faculty, 'Overall Rating', 5);
    } else {
        displayErrorOnChart('topFacultyChart', 'No Top Rated Faculty data');
    }

    // Course Rating Comparison
    if (facultyData.course_ratings && Object.keys(facultyData.course_ratings).length > 0) {
        createHorizontalBarChart('courseRatingChart', facultyData.course_ratings, 'Overall Rating', 5);
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
         tabButtons[0].classList.add('active');
         tabContents[0].classList.add('active');
    }


    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTabId = button.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
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
    const targetButton = document.querySelector(`[onclick="showTab('${tabId}')"]`);

    if (targetTab) {
        targetTab.classList.add('active');
    } else {
         console.error(`Tab content with ID ${tabId} not found.`);
    }

    if (targetButton) {
        targetButton.classList.add('active');
    } else {
        console.error(`Tab button for tab ID ${tabId} not found.`);
    }
}


// --- Reusable Chart Creation Functions ---

function createBarChart(elementId, data, label, maxValue, percent = false) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    // Destroy existing chart instance if it exists
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: label,
                data: Object.values(data),
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
                            return percent ? `${(value * 100).toFixed(1)}%` : value.toLocaleString(); // Format numbers if large
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: maxValue, // Optional max value
                    grid: {
                        color: '#e9ecef' // Lighter grid lines
                    },
                    ticks: {
                        callback: function(value) {
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
            }
        }
    });
}

function createHorizontalBarChart(elementId, data, label, maxValue) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: label,
                data: Object.values(data),
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
                    titleFont: { weight: 'bold' }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: maxValue,
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
            }
        }
    });
}

function createPieChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    // Enhanced color palette
    const colorPalette = ['#3a86ff', '#ffbe0b', '#fb5607', '#8338ec', '#4ecdc4', '#ff6b6b', '#fca311', '#14213d', '#6a0dad'];

    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: colorPalette.slice(0, Object.keys(data).length),
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
                            let total = context.chart.getDatasetMeta(0).total;
                            let percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                            return `${label}: ${value.toLocaleString()} (${percentage})`;
                        }
                    }
                }
            }
        }
    });
}

function createDoughnutChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    const colorPalette = ['#ff6b6b', '#4ecdc4', '#ffbe0b', '#3a86ff', '#8338ec', '#fb5607', '#fca311', '#14213d'];

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: colorPalette.slice(0, Object.keys(data).length),
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
                            let total = context.chart.getDatasetMeta(0).total;
                            let percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                            return `${label}: ${value.toLocaleString()} (${percentage})`;
                        }
                    }
                }
            }
        }
    });
}

// Helper function to format rating labels (e.g., "Rating_Teaching" -> "Teaching")
function formatRatingLabel(key) {
    return key.replace('Rating_', '');
}

function createRadarChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    new Chart(ctx, {
        type: 'radar',
        data: {
            // Format labels for readability
            labels: Object.keys(data).map(key => formatRatingLabel(key)),
            datasets: [{
                label: 'Average Rating',
                data: Object.values(data),
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
                    max: 5, // Assuming a 5-point rating scale
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
                            return `Rating: ${context.raw.toFixed(2)}`; // Show rating with 2 decimals
                        }
                    }
                },
                legend: {
                    display: false // Hide legend if only one dataset
                }
            }
        }
    });
}

function createScatterPlot(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    // Create dataset from CGPA and package arrays, filtering invalid entries
    const scatterData = [];
    if (data.cgpa && data.package && data.cgpa.length === data.package.length) {
        for (let i = 0; i < data.cgpa.length; i++) {
            // Ensure both cgpa and package are valid numbers
            const cgpa = parseFloat(data.cgpa[i]);
            const pkg = parseFloat(data.package[i]);
            if (!isNaN(cgpa) && !isNaN(pkg)) {
                scatterData.push({
                    x: cgpa,
                    y: pkg
                });
            }
        }
    } else {
         console.error("Invalid data format for scatter plot:", data);
         displayErrorOnChart(elementId, "Invalid scatter data");
         return;
    }


    new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'CGPA vs Package',
                data: scatterData,
                backgroundColor: 'rgba(58, 134, 255, 0.6)', // Semi-transparent blue points
                borderColor: 'rgba(58, 134, 255, 0.8)',
                pointRadius: 5, // Slightly smaller default points
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
                    // Dynamically set min/max if needed, otherwise let Chart.js decide
                    // min: Math.floor(Math.min(...data.cgpa.filter(v => !isNaN(v)))) - 0.5,
                    // max: Math.ceil(Math.max(...data.cgpa.filter(v => !isNaN(v)))) + 0.5
                },
                y: {
                     type: 'linear',
                    title: {
                        display: true,
                        text: 'Package (LPA)',
                        font: { weight: 'bold' },
                        color: '#333'
                    },
                    beginAtZero: true,
                    grid: { color: '#e9ecef' },
                    ticks: {
                        color: '#495057',
                        callback: function(value) { return `₹${value} LPA`; } // Add currency/unit
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
                            return `CGPA: ${context.parsed.x.toFixed(2)}, Package: ₹${context.parsed.y.toFixed(2)} LPA`;
                        }
                    }
                }
            }
        }
    });
}

function createMarksComparisonChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    // Check if expected keys exist
    if (!data || typeof data.Internal === 'undefined' || typeof data.External === 'undefined') {
         console.error("Invalid data for Marks Comparison chart:", data);
         displayErrorOnChart(elementId, "Invalid marks data");
         return;
    }


    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Average Marks'], // Single category label
            datasets: [
                {
                    label: 'Internal Marks',
                    data: [data.Internal],
                    backgroundColor: '#4ecdc4', // Teal
                    borderColor: '#4ecdc4',
                    borderWidth: 1,
                    borderRadius: 5
                },
                {
                    label: 'External Marks',
                    data: [data.External],
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
                              return `${context.dataset.label}: ${context.raw.toFixed(2)}`;
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
            }
        }
    });
}

function createTrendChart(elementId, data, label) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    // Sort keys (semesters/years) to ensure chronological order if possible
    const sortedKeys = Object.keys(data).sort((a, b) => {
         // Basic numeric/string sort, adjust if specific sorting logic is needed
         const numA = parseFloat(a);
         const numB = parseFloat(b);
         if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
         return String(a).localeCompare(String(b));
    });
    const sortedLabels = sortedKeys;
    const sortedData = sortedKeys.map(key => data[key]);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedLabels,
            datasets: [{
                label: label,
                data: sortedData,
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
                    display: false // Often not needed for single line trend
                },
                 tooltip: {
                     backgroundColor: 'rgba(0, 0, 0, 0.8)',
                     titleFont: { weight: 'bold' },
                     intersect: false, // Show tooltip when hovering near line
                     mode: 'index', // Show tooltips for all points at that index
                     callbacks: {
                         label: function(context) {
                              return `${label}: ${context.raw.toFixed(2)}`;
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
            }
        }
    });
}

function createStackedBarChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    // Extract gender categories and placement data
    const genders = Object.keys(data);

    // Ensure data format includes '0' and '1' keys for counts
    const datasets = [
        {
            label: 'Placed',
            // Map data ensuring 0 if key '1' is missing for a gender
            data: genders.map(gender => data[gender]?.['1'] || 0),
            backgroundColor: '#4ecdc4', // Teal for placed
            borderColor: '#4ecdc4',
            borderWidth: 1,
            borderRadius: { topLeft: 5, topRight: 5 } // Round top corners
        },
        {
            label: 'Not Placed',
             // Map data ensuring 0 if key '0' is missing
            data: genders.map(gender => data[gender]?.['0'] || 0),
            backgroundColor: '#ff6b6b', // Coral for not placed
            borderColor: '#ff6b6b',
            borderWidth: 1,
            borderRadius: { bottomLeft: 5, bottomRight: 5 } // Round bottom corners
        }
    ];

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: genders,
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
                              return `${context.dataset.label}: ${context.raw.toLocaleString()}`;
                         }
                     }
                 }
            },
            scales: {
                x: {
                    stacked: true, // Stack bars horizontally
                    grid: { display: false },
                    ticks: { color: '#495057' }
                },
                y: {
                    stacked: true, // Stack bars vertically
                    beginAtZero: true,
                    grid: { color: '#e9ecef' },
                    ticks: { color: '#495057' }
                }
            }
        }
    });
}

function createMultiLineChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    let chartInstance = Chart.getChart(elementId);
    if (chartInstance) chartInstance.destroy();

    // Extract years and rating categories dynamically
    const years = Object.keys(data).sort((a, b) => parseFloat(a) - parseFloat(b)); // Sort years numerically
    if (years.length === 0) {
         displayErrorOnChart(elementId, 'No years found in trend data');
         return;
    }

    // Get categories from the first year, assuming structure is consistent
    const categories = Object.keys(data[years[0]]);
    if (categories.length === 0) {
         displayErrorOnChart(elementId, 'No rating categories found');
         return;
    }

    // Define a color palette for different rating types
    const colorPalette = {
        'Rating_Teaching':    { border: '#3a86ff', background: 'rgba(58, 134, 255, 0.1)' },
        'Rating_Engagement':  { border: '#ffbe0b', background: 'rgba(255, 190, 11, 0.1)' },
        'Rating_Clarity':     { border: '#4ecdc4', background: 'rgba(78, 205, 196, 0.1)' },
        'Rating_Punctuality': { border: '#ff6b6b', background: 'rgba(255, 107, 107, 0.1)' },
        // Add fallback colors if needed
        'default':            { border: '#adb5bd', background: 'rgba(173, 181, 189, 0.1)'}
    };

    // Create datasets for each rating category
    const datasets = categories.map((category, index) => {
        const values = years.map(year => data[year]?.[category]); // Get value, handle missing year/category gracefully
        const colors = colorPalette[category] || colorPalette['default']; // Use default if category not in palette
        return {
            label: formatRatingLabel(category), // Use helper to clean label
            data: values,
            borderColor: colors.border,
            backgroundColor: colors.background,
            borderWidth: 2,
            fill: true, // Fill area under line
            tension: 0.1, // Slight curve
             pointRadius: 3,
             pointHoverRadius: 5,
             pointBackgroundColor: colors.border
        };
    });

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
                        boxWidth: 8
                    }
                },
                 tooltip: {
                     backgroundColor: 'rgba(0, 0, 0, 0.8)',
                     titleFont: { weight: 'bold' },
                     intersect: false,
                     mode: 'index', // Show all tooltips for the year
                     callbacks: {
                         label: function(context) {
                              return `${context.dataset.label}: ${context.raw?.toFixed(2) || 'N/A'}`; // Handle potential null/undefined
                         }
                     }
                 }
            },
            scales: {
                y: {
                    beginAtZero: false, // Ratings likely don't start at 0
                    min: 0, // Set min if appropriate (e.g., rating scales)
                    max: 5, // Set max if appropriate
                    title: {
                        display: true,
                        text: 'Average Rating (out of 5)',
                        font: { weight: 'bold' },
                        color: '#333'
                    },
                    grid: { color: '#e9ecef' },
                    ticks: {
                        color: '#495057',
                        stepSize: 1 // Adjust step size if needed
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
            }
        }
    });
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
        // Optionally explicitly display errors on all charts using displayErrorOnChart
        // This might be redundant if the global message is clear enough.
        return; // Stop further execution
    }

    // Clear any global error message if data was loaded successfully
    const globalError = document.querySelector('.global-error');
    if (globalError) {
        globalError.remove();
    }

    // Initialize charts for each section using the fetched data
    initializeExamCharts(dashboardData.exam_data);
    initializePlacementCharts(dashboardData.placement_data);
    initializeFacultyCharts(dashboardData.faculty_data);
});