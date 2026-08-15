/**
 * Smart Garden Dashboard JavaScript
 * Handles real-time updates and chart rendering
 */

// Main dashboard initialization
document.addEventListener('DOMContentLoaded', function () {
    // Initialize charts if we're on the dashboard page
    if (document.getElementById('sensorChart')) {
        initializeSensorChart();
    }

    // Update sensor data every 5 seconds
    setInterval(updateSensorData, 5000);
});

// Initialize sensor chart
function initializeSensorChart() {
    const ctx = document.getElementById('sensorChart').getContext('2d');

    // Configure chart with empty data initially
    window.sensorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Suhu (°C)',
                data: [],
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: {
                            minute: 'HH:mm'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Waktu'
                    }
                },
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Nilai'
                    }
                }
            }
        }
    });

    // Fetch initial chart data
    fetchSensorData('temperature', 'day');

    // Handle sensor button clicks
    document.querySelectorAll('.btn-group .btn').forEach(button => {
        button.addEventListener('click', function () {
            // Remove active class from all buttons
            document.querySelectorAll('.btn-group .btn').forEach(btn => {
                btn.classList.remove('active');
            });

            // Add active class to clicked button
            this.classList.add('active');

            // Fetch data for selected sensor
            const sensorType = this.getAttribute('data-sensor');
            fetchSensorData(sensorType, 'day');
        });
    });
}

// Fetch sensor data from the server
function fetchSensorData(sensorType, timeRange) {
    fetch(`/dashboard/sensor-data?type=${sensorType}&timeRange=${timeRange}`)
        .then(response => response.json())
        .then(data => {
            updateChart(sensorType, data.data);
        })
        .catch(error => {
            console.error('Error fetching sensor data:', error);
        });
}

// Update chart with new data
function updateChart(sensorType, data) {
    if (!window.sensorChart) return;

    const labels = data.map(item => new Date(item.timestamp));
    const values = data.map(item => item.value);

    let label, color, bgColor;

    switch (sensorType) {
        case 'temperature':
            label = 'Suhu (°C)';
            color = '#e74c3c';
            bgColor = 'rgba(231, 76, 60, 0.1)';
            break;
        case 'humidity':
            label = 'Kelembaban Udara (%)';
            color = '#3498db';
            bgColor = 'rgba(52, 152, 219, 0.1)';
            break;
        case 'soil_moisture':
            label = 'Kelembaban Tanah (%)';
            color = '#2ecc71';
            bgColor = 'rgba(46, 204, 113, 0.1)';
            break;
        default:
            label = 'Nilai Sensor';
            color = '#3498db';
            bgColor = 'rgba(52, 152, 219, 0.1)';
    }

    window.sensorChart.data.labels = labels;
    window.sensorChart.data.datasets[0].label = label;
    window.sensorChart.data.datasets[0].data = values;
    window.sensorChart.data.datasets[0].borderColor = color;
    window.sensorChart.data.datasets[0].backgroundColor = bgColor;

    window.sensorChart.update();
}

// Update sensor values on the dashboard
function updateSensorData() {
    // Only proceed if we're on a page with sensor displays
    if (!document.getElementById('temperature-value')) return;

    fetch('/api/latest')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const values = data.data;

                // Update temperature with animation
                if (values.temperature !== null) {
                    const tempElement = document.getElementById('temperature-value');
                    const currentTemp = parseFloat(tempElement.textContent);

                    if (currentTemp !== values.temperature.toFixed(1)) {
                        tempElement.classList.add('value-change');
                        tempElement.textContent = values.temperature.toFixed(1);

                        setTimeout(() => {
                            tempElement.classList.remove('value-change');
                        }, 1000);
                    }

                    // Update temperature status
                    let tempStatus = '';
                    if (values.temperature > 30) {
                        tempStatus = '<span class="badge bg-danger">Tinggi</span>';
                    } else if (values.temperature < 20) {
                        tempStatus = '<span class="badge bg-info">Rendah</span>';
                    } else {
                        tempStatus = '<span class="badge bg-success">Normal</span>';
                    }
                    document.getElementById('temperature-status').innerHTML = tempStatus;
                }

                // Update humidity with animation
                if (values.humidity !== null) {
                    const humElement = document.getElementById('humidity-value');
                    const currentHum = parseFloat(humElement.textContent);

                    if (currentHum !== values.humidity.toFixed(1)) {
                        humElement.classList.add('value-change');
                        humElement.textContent = values.humidity.toFixed(1);

                        setTimeout(() => {
                            humElement.classList.remove('value-change');
                        }, 1000);
                    }

                    // Update humidity status
                    let humStatus = '';
                    if (values.humidity > 80) {
                        humStatus = '<span class="badge bg-info">Tinggi</span>';
                    } else if (values.humidity < 40) {
                        humStatus = '<span class="badge bg-warning">Rendah</span>';
                    } else {
                        humStatus = '<span class="badge bg-success">Normal</span>';
                    }
                    document.getElementById('humidity-status').innerHTML = humStatus;
                }

                // Update soil moisture with animation
                if (values.soilMoisture !== null) {
                    const soilElement = document.getElementById('soil-moisture-value');
                    const currentSoil = parseFloat(soilElement.textContent);

                    if (currentSoil !== values.soilMoisture.toFixed(1)) {
                        soilElement.classList.add('value-change');
                        soilElement.textContent = values.soilMoisture.toFixed(1);

                        setTimeout(() => {
                            soilElement.classList.remove('value-change');
                        }, 1000);
                    }

                    // Update soil moisture status
                    let soilStatus = '';
                    if (values.soilMoisture > 80) {
                        soilStatus = '<span class="badge bg-info">Basah</span>';
                    } else if (values.soilMoisture < 30) {
                        soilStatus = '<span class="badge bg-danger">Kering</span>';
                    } else {
                        soilStatus = '<span class="badge bg-success">Normal</span>';
                    }
                    document.getElementById('soil-moisture-status').innerHTML = soilStatus;
                }

                // Update valve status if it exists on the page
                const valveStatusElement = document.getElementById('valve-status');
                if (valveStatusElement) {
                    valveStatusElement.textContent = values.valveStatus === 'on' ? 'Aktif' : 'Tidak Aktif';

                    // Update valve indicator if it exists
                    const valveIndicator = document.querySelector('.status-indicator');
                    if (valveIndicator) {
                        if (values.valveStatus === 'on') {
                            valveIndicator.classList.remove('status-off');
                            valveIndicator.classList.add('status-on');
                        } else {
                            valveIndicator.classList.remove('status-on');
                            valveIndicator.classList.add('status-off');
                        }
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error updating sensor values:', error);
        });
}