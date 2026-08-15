const SensorData = require('../models/SensorData');
const DeviceLog = require('../models/DeviceLog');
const mqttService = require('../services/mqttService');

// Render dashboard home
const getDashboard = (req, res) => {
    const latestValues = mqttService.getLatestValues();

    res.render('dashboard/index', {
        title: 'Smart Garden Dashboard',
        user: req.session.user,
        latestValues
    });
};

// Get sensor data for charts
const getSensorData = async (req, res) => {
    try {
        const { type, timeRange } = req.query;

        // Define allowed sensor types - tambah soil_ph
        const allowedTypes = ['temperature', 'humidity', 'soil_moisture', 'soil_ph'];

        if (!allowedTypes.includes(type)) {
            return res.status(400).json({
                error: 'Invalid sensor type'
            });
        }

        const data = await SensorData.findByType(type, timeRange || 'day');

        res.json({ data });
    } catch (error) {
        console.error('Error fetching sensor data:', error);
        return res.status(500).json({
            error: 'Database error'
        });
    }
};

// Get device logs
const getDeviceLogs = async (req, res) => {
    try {
        const { device, limit } = req.query;
        const limitValue = parseInt(limit) || 10;

        let logs;
        if (device) {
            logs = await DeviceLog.findByDevice(device, limitValue);
        } else {
            logs = await DeviceLog.findAll(limitValue);
        }

        res.json({ logs });
    } catch (error) {
        console.error('Error fetching device logs:', error);
        return res.status(500).json({
            error: 'Database error'
        });
    }
};

// Render device control page
const getDeviceControl = async (req, res) => {
    try {
        const latestValues = mqttService.getLatestValues();

        // Get recent logs for the valve
        const logs = await DeviceLog.findByDevice('water_valve', 10);

        res.render('dashboard/device-control', {
            title: 'Kontrol Perangkat',
            user: req.session.user,
            latestValues,
            logs
        });
    } catch (error) {
        console.error('Error rendering device control page:', error);
        const latestValues = mqttService.getLatestValues();
        res.render('dashboard/device-control', {
            title: 'Kontrol Perangkat',
            user: req.session.user,
            latestValues,
            logs: []
        });
    }
};

// Control device
const controlDevice = async (req, res) => {
    try {
        const { device, action } = req.body;

        if (device !== 'water_valve') {
            return res.status(400).json({
                success: false,
                message: 'Unsupported device'
            });
        }

        if (action !== 'on' && action !== 'off') {
            return res.status(400).json({
                success: false,
                message: 'Invalid action'
            });
        }

        const status = action === 'on';
        const result = mqttService.controlValve(status, req.session.user.username);

        if (!result) {
            return res.status(500).json({
                success: false,
                message: 'Failed to control device'
            });
        }

        res.json({
            success: true,
            message: `Successfully turned ${action} the water valve`
        });
    } catch (error) {
        console.error('Error controlling device:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to control device'
        });
    }
};

const controlAuto = async (req, res) => {
    try {
        const { device, action } = req.body;

        if (device !== 'water_valve') {
            return res.status(400).json({
                success: false,
                message: 'Unsupported device'
            });
        }

        if (action !== 'on' && action !== 'off') {
            return res.status(400).json({
                success: false,
                message: 'Invalid action'
            });
        }

        const autoStatus = action === 'on';
        const result = mqttService.controlAuto(autoStatus, req.session.user.username);

        if (!result) {
            return res.status(500).json({
                success: false,
                message: 'Failed to control auto mode'
            });
        }

        res.json({
            success: true,
            message: `Successfully turned ${action} auto mode`
        });
    } catch (error) {
        console.error('Error controlling auto mode:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to control auto mode'
        });
    }
};

// Get sensor history with pagination
const getSensorHistory = async (req, res) => {
    try {
        const { type = 'temperature', page = 1, limit = 20, startDate, endDate } = req.query;

        // Define allowed sensor types - tambah soil_ph
        const allowedTypes = ['temperature', 'humidity', 'soil_moisture', 'soil_ph', 'all'];

        if (!allowedTypes.includes(type)) {
            return res.status(400).render('error', {
                error: { message: 'Invalid sensor type' }
            });
        }

        const result = await SensorData.findAll({
            type,
            startDate,
            endDate,
            page,
            limit
        });

        res.render('dashboard/sensor-history', {
            title: 'History Data Sensor',
            user: req.session.user,
            data: result.data,
            currentPage: result.pagination.currentPage,
            totalPages: result.pagination.totalPages,
            totalItems: result.pagination.totalItems,
            type,
            limit: result.pagination.itemsPerPage,
            startDate,
            endDate
        });
    } catch (error) {
        console.error('Error fetching sensor history:', error);
        return res.status(500).render('error', {
            error: { message: 'Database error', stack: error.stack }
        });
    }
};

const exportSensorData = async (req, res) => {
    try {
        const { type = 'temperature', startDate, endDate } = req.query;

        // Define allowed sensor types - tambah soil_ph
        const allowedTypes = ['temperature', 'humidity', 'soil_moisture', 'soil_ph', 'all'];

        if (!allowedTypes.includes(type)) {
            return res.status(400).send('Invalid sensor type');
        }

        const result = await SensorData.findAll({
            type,
            startDate,
            endDate,
            page: 1,
            limit: 10000 // Export more data
        });

        // Format data for CSV
        const formattedData = result.data.map(row => {
            let sensorName, unit;

            switch(row.sensorType) {
                case 'temperature':
                    sensorName = 'Suhu';
                    unit = ' °C';
                    break;
                case 'humidity':
                    sensorName = 'Kelembaban Udara';
                    unit = ' %';
                    break;
                case 'soil_moisture':
                    sensorName = 'Kelembaban Tanah';
                    unit = ' %';
                    break;
                case 'soil_ph':
                    sensorName = 'pH Tanah';
                    unit = '';
                    break;
                default:
                    sensorName = row.sensorType;
                    unit = '';
            }

            return {
                sensor_type: sensorName,
                value: row.value.toFixed(row.sensorType === 'soil_ph' ? 2 : 1) + unit,
                timestamp: row.timestamp.toLocaleString('id-ID')
            };
        });

        // Create CSV content
        let csv = 'Tipe Sensor,Nilai,Tanggal & Waktu\n';
        formattedData.forEach(item => {
            csv += `"${item.sensor_type}","${item.value}","${item.timestamp}"\n`;
        });

        // Set headers for file download
        const today = new Date().toISOString().split('T')[0];
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=sensor_data_${today}.csv`);

        res.send(csv);
    } catch (error) {
        console.error('Error exporting sensor data:', error);
        return res.status(500).send('Database error');
    }
};

module.exports = {
    getDashboard,
    getSensorData,
    getDeviceLogs,
    getDeviceControl,
    controlDevice,
    controlAuto,
    getSensorHistory,
    exportSensorData
};