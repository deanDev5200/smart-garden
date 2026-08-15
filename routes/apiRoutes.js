const express = require('express');
const router = express.Router();
const {
    getDb
} = require('../utils/database');
const mqttService = require('../services/mqttService');

// API endpoint to get latest sensor values
router.get('/latest', (req, res) => {
    const latestValues = mqttService.getLatestValues();
    res.json({
        success: true,
        data: latestValues
    });
});

// API endpoint for device status
router.get('/device-status', (req, res) => {
    const {
        device
    } = req.query;

    if (device !== 'water_valve') {
        return res.status(400).json({
            success: false,
            message: 'Unsupported device'
        });
    }

    const latestValues = mqttService.getLatestValues();
    res.json({
        success: true,
        data: {
            status: latestValues.valveStatus,
            autoStatus: latestValues.autoStatus
        }
    });
});

module.exports = router;