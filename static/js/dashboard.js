// static/js/dashboard.js

// Chart.js defaults for consistent styling
Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#666';

// Fetch data from the API
async function fetchDashboardData() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const data = await fetchDashboardData();
    if (!data) {
        displayErrorMessage();
        return;
    }
    
    // Initialize tab functionality
    setupTabNavigation();
    
    // Academic Performance Charts
    initializeExamCharts(data.exam_data);
    
    // Placement Statistics Charts
    initializePlacementCharts(data.placement_data);
    
    // Faculty Evaluation Charts
    initializeFacultyCharts(data.faculty_data);
});

// Display error message if data fetching fails
function displayErrorMessage() {
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        const chartContainer = card.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = '<div class="error-message">Error loading data. Please try again later.</div>';
        }
    });
}

// Tab Navigation Setup
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and tabs
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Show the corresponding tab content
            const tabId = button.getAttribute('onclick').match(/'([^']+)'/)[1];
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Initialize Academic Performance Charts
function initializeExamCharts(examData) {
    // Grade Distribution
    if (document.getElementById('gradeChart')) {
        createPieChart('gradeChart', examData.grade_distribution);
    }
    
    // Department Performance
    if (document.getElementById('departmentPerformanceChart')) {
        createBarChart('departmentPerformanceChart', examData.performance_by_department, 'Average Marks', 100);
    }
    
    // Top Subjects
    if (document.getElementById('topSubjectsChart')) {
        createHorizontalBarChart('topSubjectsChart', examData.subject_performance, 'Average Marks', 100);
    }
    
    // More charts will be initialized here...
}

// Initialize Placement Statistics Charts
function initializePlacementCharts(placementData) {
    // Placement Rate by Department
    if (document.getElementById('placementRateChart')) {
        createBarChart('placementRateChart', placementData.placement_rate_by_dept, 'Placement Rate', 1, percent = true);
    }
    
    // Average Package by Department
    if (document.getElementById('packageChart')) {
        createBarChart('packageChart', placementData.package_by_dept, 'Average Package (LPA)', null);
    }
    
    // Top Skills
    if (document.getElementById('skillsChart')) {
        createHorizontalBarChart('skillsChart', placementData.top_skills, 'Frequency', null);
    }
    
    // More charts will be initialized here...
}

// Initialize Faculty Evaluation Charts
function initializeFacultyCharts(facultyData) {
    // Average Ratings by Category
    if (document.getElementById('ratingsChart')) {
        createRadarChart('ratingsChart', facultyData.avg_faculty_ratings);
    }
    
    // Department Teaching Ratings
    if (document.getElementById('deptRatingsChart')) {
        createBarChart('deptRatingsChart', facultyData.dept_teaching_ratings, 'Teaching Rating', 5);
    }
    
    // More charts will be initialized here...
}

// Reusable Chart Creation Functions
function createBarChart(elementId, data, label, maxValue, percent = false) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: label,
                data: Object.values(data),
                backgroundColor: '#3a86ff',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let value = context.raw;
                            return percent ? `${(value * 100).toFixed(1)}%` : value;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: maxValue,
                    ticks: {
                        callback: function(value) {
                            return percent ? `${(value * 100).toFixed(0)}%` : value;
                        }
                    }
                }
            }
        }
    });
}

function createHorizontalBarChart(elementId, data, label, maxValue) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: label,
                data: Object.values(data),
                backgroundColor: '#36a2eb',
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: maxValue
                }
            }
        }
    });
}

function createPieChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    
    const colorPalette = ['#ff6b6b', '#4ecdc4', '#ffbe0b', '#3a86ff', '#8338ec', '#fb5607'];
    
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: colorPalette.slice(0, Object.keys(data).length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12
                    }
                }
            }
        }
    });
}

function createDoughnutChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    
    const colorPalette = ['#ff6b6b', '#4ecdc4', '#ffbe0b', '#3a86ff', '#8338ec', '#fb5607'];
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: colorPalette.slice(0, Object.keys(data).length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12
                    }
                }
            }
        }
    });
}

function createRadarChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: Object.keys(data).map(key => formatRatingLabel(key)),
            datasets: [{
                label: 'Average Rating',
                data: Object.values(data),
                backgroundColor: 'rgba(58, 134, 255, 0.2)',
                borderColor: 'rgba(58, 134, 255, 0.8)',
                pointBackgroundColor: 'rgba(58, 134, 255, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(58, 134, 255, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 5,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Helper function to format rating labels
function formatRatingLabel(key) {
    return key.replace('Rating_', '');
}

// Function to show a specific tab
function showTab(tabId) {
    // Remove active class from all tabs and buttons
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Add active class to selected tab and button
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[onclick="showTab('${tabId}')"]`).classList.add('active');
}
// Additional chart functions for the dashboard.js file

// Scatter plot for CGPA vs Package correlation
function createScatterPlot(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    
    // Create dataset from CGPA and package arrays
    const scatterData = [];
    for (let i = 0; i < data.cgpa.length; i++) {
        if (data.cgpa[i] && data.package[i]) {
            scatterData.push({
                x: data.cgpa[i],
                y: data.package[i]
            });
        }
    }
    
    new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'CGPA vs Package',
                data: scatterData,
                backgroundColor: 'rgba(58, 134, 255, 0.6)',
                borderColor: 'rgba(58, 134, 255, 0.8)',
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'CGPA'
                    },
                    min: Math.floor(Math.min(...data.cgpa)) - 0.5,
                    max: Math.ceil(Math.max(...data.cgpa)) + 0.5
                },
                y: {
                    title: {
                        display: true,
                        text: 'Package (LPA)'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `CGPA: ${context.parsed.x}, Package: ₹${context.parsed.y} LPA`;
                        }
                    }
                }
            }
        }
    });
}

// Bar chart comparing internal and external marks
function createMarksComparisonChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Marks Distribution'],
            datasets: [
                {
                    label: 'Internal Marks',
                    data: [data.Internal],
                    backgroundColor: '#4ecdc4',
                    borderRadius: 5
                },
                {
                    label: 'External Marks',
                    data: [data.External],
                    backgroundColor: '#ff6b6b',
                    borderRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Average Marks'
                    }
                }
            }
        }
    });
}

// Line chart for year/semester performance trend
function createTrendChart(elementId, data, label) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    
    // Sort the keys to ensure chronological order
    const sortedKeys = Object.keys(data).sort();
    const sortedData = {};
    sortedKeys.forEach(key => {
        sortedData[key] = data[key];
    });
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(sortedData),
            datasets: [{
                label: label,
                data: Object.values(sortedData),
                backgroundColor: 'rgba(58, 134, 255, 0.2)',
                borderColor: 'rgba(58, 134, 255, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(58, 134, 255, 1)',
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Stacked bar chart for gender placement comparison
function createStackedBarChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    
    // Extract gender categories and placement data
    const genders = Object.keys(data);
    
    // Create datasets for placed and not placed
    const datasets = [
        {
            label: 'Placed',
            data: genders.map(gender => data[gender]['1'] || 0),
            backgroundColor: '#4ecdc4',
            borderRadius: 5
        },
        {
            label: 'Not Placed',
            data: genders.map(gender => data[gender]['0'] || 0),
            backgroundColor: '#ff6b6b',
            borderRadius: 5
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
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true
                }
            }
        }
    });
}

// Multi-series line chart for faculty rating trends
function createMultiLineChart(elementId, data) {
    const ctx = document.getElementById(elementId)?.getContext('2d');
    if (!ctx) return;
    
    // Extract years and rating categories
    const years = Object.keys(data).sort();
    const categories = Object.keys(data[years[0]]);
    
    // Color palette for different rating types
    const colorPalette = {
        'Rating_Teaching': { 
            border: 'rgba(58, 134, 255, 1)', 
            background: 'rgba(58, 134, 255, 0.1)' 
        },
        'Rating_Engagement': { 
            border: 'rgba(255, 107, 107, 1)', 
            background: 'rgba(255, 107, 107, 0.1)' 
        },
        'Rating_Clarity': { 
            border: 'rgba(78, 205, 196, 1)', 
            background: 'rgba(78, 205, 196, 0.1)' 
        },
        'Rating_Punctuality': { 
            border: 'rgba(255, 190, 11, 1)', 
            background: 'rgba(255, 190, 11, 0.1)' 
        }
    };
    
    // Create datasets for each rating category
    const datasets = categories.map(category => {
        const values = years.map(year => data[year][category]);
        return {
            label: formatRatingLabel(category),
            data: values,
            borderColor: colorPalette[category]?.border || 'rgba(100, 100, 100, 1)',
            backgroundColor: colorPalette[category]?.background || 'rgba(100, 100, 100, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.2
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
            scales: {
                y: {
                    beginAtZero: true,
                    max: 5,
                    title: {
                        display: true,
                        text: 'Rating (out of 5)'
                    }
                }
            }
        }
    });
}

// Add the following functions to initializeExamCharts
// Inside initializeExamCharts function add:
if (document.getElementById('marksComparisonChart')) {
    createMarksComparisonChart('marksComparisonChart', examData.marks_comparison);
}

if (document.getElementById('semesterChart')) {
    createTrendChart('semesterChart', examData.semester_performance, 'Average Marks');
}

// Add the following to initializePlacementCharts function:
if (document.getElementById('cgpaPackageChart')) {
    createScatterPlot('cgpaPackageChart', placementData.cgpa_package_data);
}

if (document.getElementById('companiesChart')) {
    createHorizontalBarChart('companiesChart', placementData.top_companies, 'Number of Placements', null);
}

if (document.getElementById('genderPlacementChart') && Object.keys(placementData.gender_placement).length > 0) {
    createStackedBarChart('genderPlacementChart', placementData.gender_placement);
}

// Add the following to initializeFacultyCharts function:
if (document.getElementById('ratingTrendsChart')) {
    createMultiLineChart('ratingTrendsChart', facultyData.year_ratings);
}

if (document.getElementById('topFacultyChart')) {
    createHorizontalBarChart('topFacultyChart', facultyData.top_faculty, 'Overall Rating', 5);
}

if (document.getElementById('courseRatingChart')) {
    createHorizontalBarChart('courseRatingChart', facultyData.course_ratings, 'Overall Rating', 5);
}

if (document.getElementById('facultySemesterChart')) {
    createTrendChart('facultySemesterChart', facultyData.semester_ratings, 'Teaching Rating');
}