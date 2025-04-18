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
    
    // Create charts
    createGenderChart(data.gender_distribution);
    createExamTypeChart(data.exam_performance);
    createYearChart(data.year_distribution);
    createDepartmentChart(data.performance_by_department);
    createSubjectsChart(data.top_subjects);
    createCGPAChart(data.cgpa_distribution);
    createMarksChart(data.marks_distribution);
});

function displayErrorMessage() {
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        const chartContainer = card.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = '<div class="error-message">Error loading data. Please try again later.</div>';
        }
    });
}

// Gender Distribution Chart
function createGenderChart(data) {
    const ctx = document.getElementById('genderChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: ['#ff6b6b', '#4ecdc4'],
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

// Exam Type Performance Chart
function createExamTypeChart(data) {
    const ctx = document.getElementById('examTypeChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: 'Average Marks',
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
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// Year Distribution Chart
function createYearChart(data) {
    const ctx = document.getElementById('yearChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: ['#ffbe0b', '#fb5607', '#8338ec', '#3a86ff'],
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

// Department Performance Chart
function createDepartmentChart(data) {
    const ctx = document.getElementById('departmentChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: 'Average Marks',
                data: Object.values(data),
                backgroundColor: [
                    '#ff6b6b', '#4ecdc4', '#ffe66d', '#3a86ff', '#8338ec', '#fb5607'
                ],
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// Top Subjects Chart
function createSubjectsChart(data) {
    const ctx = document.getElementById('subjectsChart').getContext('2d');
    
    // Get labels and data in sorted order
    const labels = Object.keys(data);
    const values = Object.values(data);
    
    new Chart(ctx, {
        type: 'horizontalBar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Marks',
                data: values,
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
                    max: 100
                }
            }
        }
    });
}

// CGPA Distribution Chart
function createCGPAChart(data) {
    const ctx = document.getElementById('cgpaChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.data,
                backgroundColor: ['#ff6b6b', '#ffbe0b', '#4ecdc4', '#3a86ff'],
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

// Marks Distribution Chart
function createMarksChart(data) {
    const ctx = document.getElementById('marksChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Number of Students',
                data: data.data,
                backgroundColor: '#8338ec',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}