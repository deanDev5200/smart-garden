const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const {
    isAuthenticated
} = require('../middleware/authMiddleware');
const { validateDeviceControl, validateSensorQuery } = require('../middleware/validationMiddleware');

// Dashboard home route
router.get('/', isAuthenticated, dashboardController.getDashboard);

// Device control routes
router.get('/device-control', isAuthenticated, dashboardController.getDeviceControl);
router.post('/device-control', isAuthenticated, validateDeviceControl, dashboardController.controlDevice);
router.post('/auto-control', isAuthenticated, validateDeviceControl, dashboardController.controlAuto);

// API routes for dashboard data
router.get('/sensor-data', isAuthenticated, validateSensorQuery, dashboardController.getSensorData);
router.get('/device-logs', isAuthenticated, dashboardController.getDeviceLogs);
router.get('/sensor-history', isAuthenticated, validateSensorQuery, dashboardController.getSensorHistory);
router.get('/export-sensor-data', isAuthenticated, validateSensorQuery, dashboardController.exportSensorData);

module.exports = router;