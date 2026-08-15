/**
 * Smart Garden Device Control JavaScript
 * Handles device control functionality and log updates
 */

// Initialize device control
document.addEventListener('DOMContentLoaded', function () {
    // Only initialize if we're on the device control page
    if (!document.getElementById('valve-toggle')) return;

    const valveToggle = document.getElementById('valve-toggle');
    const valveOn = document.getElementById('valve-on');
    const valveOff = document.getElementById('valve-off');
    const valveIndicator = document.getElementById('valve-indicator');
    const valveStatusText = document.getElementById('valve-status-text');
    const valveStatusInfo = document.getElementById('valve-status-info');
    const refreshLogsBtn = document.getElementById('refresh-logs');

    // Handle toggle switch
    valveToggle.addEventListener('change', function () {
        const action = this.checked ? 'on' : 'off';
        controlValve(action);
    });

    // Handle on button
    valveOn.addEventListener('click', function () {
        valveToggle.checked = true;
        controlValve('on');
    });

    // Handle off button
    valveOff.addEventListener('click', function () {
        valveToggle.checked = false;
        controlValve('off');
    });

    // Handle refresh logs button
    if (refreshLogsBtn) {
        refreshLogsBtn.addEventListener('click', function () {
            fetchDeviceLogs();
        });
    }

    // Initialize status and logs
    getDeviceStatus();
    fetchDeviceLogs();

    // Update every 10 seconds
    setInterval(function () {
        getDeviceStatus();
        fetchDeviceLogs();

        // Update last active time
        const lastActiveElement = document.getElementById('last-active');
        if (lastActiveElement) {
            lastActiveElement.textContent = 'Baru saja';
        }
    }, 10000);
});

// Send command to control the valve
function controlValve(action) {
    // Get UI elements
    const valveOn = document.getElementById('valve-on');
    const valveOff = document.getElementById('valve-off');
    const valveToggle = document.getElementById('valve-toggle');
    const valveIndicator = document.getElementById('valve-indicator');
    const valveStatusText = document.getElementById('valve-status-text');
    const valveStatusInfo = document.getElementById('valve-status-info');

    // Show loading state
    if (valveOn) valveOn.disabled = true;
    if (valveOff) valveOff.disabled = true;
    if (valveToggle) valveToggle.disabled = true;

    // Send request to server
    fetch('/dashboard/device-control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                device: 'water_valve',
                action: action
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success toast
                showToast('Sukses', data.message, 'success');

                // Update UI
                if (action === 'on') {
                    if (valveIndicator) {
                        valveIndicator.classList.remove('status-off');
                        valveIndicator.classList.add('status-on');
                    }
                    if (valveStatusText) valveStatusText.textContent = 'Status: Aktif';
                    if (valveStatusInfo) valveStatusInfo.textContent = 'Keran air sedang menyala';
                } else {
                    if (valveIndicator) {
                        valveIndicator.classList.remove('status-on');
                        valveIndicator.classList.add('status-off');
                    }
                    if (valveStatusText) valveStatusText.textContent = 'Status: Tidak Aktif';
                    if (valveStatusInfo) valveStatusInfo.textContent = 'Keran air sedang mati';
                }

                // Fetch updated logs
                fetchDeviceLogs();
            } else {
                // Show error toast
                showToast('Error', data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Error', 'Terjadi kesalahan saat mengontrol perangkat', 'error');
        })
        .finally(() => {
            // Re-enable buttons
            if (valveOn) valveOn.disabled = false;
            if (valveOff) valveOff.disabled = false;
            if (valveToggle) valveToggle.disabled = false;
        });
}

// Fetch device logs from server
function fetchDeviceLogs() {
    const logsTableElement = document.getElementById('device-logs');
    if (!logsTableElement) return;

    fetch('/dashboard/device-logs?device=water_valve&limit=10')
        .then(response => response.json())
        .then(data => {
            if (data.logs) {
                updateLogsTable(data.logs);
            }
        })
        .catch(error => {
            console.error('Error fetching logs:', error);
        });
}

// Update logs table with new data
function updateLogsTable(logs) {
    const logsTable = document.getElementById('device-logs');
    if (!logsTable) return;

    if (logs.length === 0) {
        logsTable.innerHTML = `
      <tr>
        <td colspan="4" class="text-center">Tidak ada log aktivitas</td>
      </tr>
    `;
        return;
    }

    let html = '';

    logs.forEach(log => {
        const timestamp = new Date(log.timestamp).toLocaleString('id-ID');
        const actionBadge = log.action === 'manual_control' ?
            '<span class="badge bg-primary">Kendali Manual</span>' :
            '<span class="badge bg-info">Update Status</span>';
        const statusBadge = log.status === 'on' ?
            '<span class="badge bg-success">Hidup</span>' :
            '<span class="badge bg-danger">Mati</span>';

        html += `
      <tr>
        <td>${timestamp}</td>
        <td>${actionBadge}</td>
        <td>${statusBadge}</td>
        <td>${log.performed_by}</td>
      </tr>
    `;
    });

    logsTable.innerHTML = html;
}

// Get current device status
function getDeviceStatus() {
    const valveToggle = document.getElementById('valve-toggle');
    const valveIndicator = document.getElementById('valve-indicator');
    const valveStatusText = document.getElementById('valve-status-text');
    const valveStatusInfo = document.getElementById('valve-status-info');

    if (!valveToggle && !valveIndicator) return;

    fetch('/api/device-status?device=water_valve')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const status = data.data.status;

                // Update UI
                if (valveToggle) valveToggle.checked = status === 'on';

                if (status === 'on') {
                    if (valveIndicator) {
                        valveIndicator.classList.remove('status-off');
                        valveIndicator.classList.add('status-on');
                    }
                    if (valveStatusText) valveStatusText.textContent = 'Status: Aktif';
                    if (valveStatusInfo) valveStatusInfo.textContent = 'Keran air sedang menyala';
                } else {
                    if (valveIndicator) {
                        valveIndicator.classList.remove('status-on');
                        valveIndicator.classList.add('status-off');
                    }
                    if (valveStatusText) valveStatusText.textContent = 'Status: Tidak Aktif';
                    if (valveStatusInfo) valveStatusInfo.textContent = 'Keran air sedang mati';
                }
            }
        })
        .catch(error => {
            console.error('Error getting device status:', error);
        });
}

// Show toast notification
function showToast(title, message, type = 'info') {
    // Check if toast container exists, create if not
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }

    // Set the icon based on type
    let icon;
    let bgClass;

    switch (type) {
        case 'success':
            icon = 'fas fa-check-circle';
            bgClass = 'bg-success text-white';
            break;
        case 'error':
            icon = 'fas fa-exclamation-circle';
            bgClass = 'bg-danger text-white';
            break;
        case 'warning':
            icon = 'fas fa-exclamation-triangle';
            bgClass = 'bg-warning';
            break;
        default:
            icon = 'fas fa-info-circle';
            bgClass = 'bg-info text-white';
    }

    // Create toast element
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
    <div id="${toastId}" class="toast ${bgClass}" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header">
        <i class="${icon} me-2"></i>
        <strong class="me-auto">${title}</strong>
        <small>Baru saja</small>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    </div>
  `;

    // Add toast to container
    toastContainer.innerHTML += toastHtml;

    // Initialize and show the toast
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        delay: 3000
    });
    toast.show();

    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function () {
        toastElement.remove();
    });
}