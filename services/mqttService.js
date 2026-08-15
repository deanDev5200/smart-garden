const mqtt = require('mqtt');
const SensorData = require('../models/SensorData');
const DeviceLog = require('../models/DeviceLog');
const fs = require('fs');
const path = require('path');
const { mqttLogger } = require('../utils/logger');

// Configuration from env variables
const MQTT_HOST = process.env.MQTT_HOST || 'localhost';
const MQTT_PORT = process.env.MQTT_PORT || 1883;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_CLIENT_ID = process.env.MQTT_CLIENT_ID || `smart-garden-dashboard-${Math.random().toString(16).substring(2, 10)}`;
const MQTT_USE_SSL = process.env.MQTT_USE_SSL === 'true';
const MQTT_CA_FILE = process.env.MQTT_CA_FILE;

// MQTT Topics
const TOPICS = {
    TEMPERATURE: 'smart-garden/sensors/temperature',
    HUMIDITY: 'smart-garden/sensors/humidity',
    SOIL_MOISTURE: 'smart-garden/sensors/soil-moisture',
    SOIL_PH: 'smart-garden/sensors/soil-ph',  // Tambah topic untuk pH tanah
    VALVE_CONTROL: 'smart-garden/control/valve',
    VALVE_STATUS: 'smart-garden/status/valve',
	AUTO_STATUS: 'smart-garden/status/auto',
    AUTO_CONTROL: 'smart-garden/control/auto'
};

let client = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 second

// Store latest sensor values
const latestValues = {
    temperature: null,
    humidity: null,
    soilMoisture: null,
    soilPH: null,  // Tambah property untuk pH tanah
    valveStatus: 'off',
    autoStatus: 'off'
};

// Connect to MQTT broker
const connect = () => {
    mqttLogger.info(`Connecting to MQTT broker: ${MQTT_HOST}:${MQTT_PORT}`);

    // Prepare connection options
    const options = {
        clientId: MQTT_CLIENT_ID,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
        port: MQTT_PORT
    };

    // Add authentication if provided
    if (MQTT_USERNAME && MQTT_PASSWORD) {
        options.username = MQTT_USERNAME;
        options.password = MQTT_PASSWORD;
    }

    // Add SSL/TLS support if enabled
    if (MQTT_USE_SSL) {
        options.protocol = 'mqtts';

        // Add CA certificate if provided
        if (MQTT_CA_FILE) {
            try {
                const caFilePath = path.resolve(MQTT_CA_FILE);
                if (fs.existsSync(caFilePath)) {
                    options.ca = fs.readFileSync(caFilePath);
                    mqttLogger.info('Loaded CA certificate from:', caFilePath);
                } else {
                    mqttLogger.error('CA file not found:', caFilePath);
                }
            } catch (error) {
                mqttLogger.error('Error loading CA certificate:', error);
            }
        }

        // Require TLS with specific versions and disable rejected certs
        options.rejectUnauthorized = true;
    }

    // Create MQTT client
    const connectUrl = `${MQTT_USE_SSL ? 'mqtts' : 'mqtt'}://${MQTT_HOST}`;
    client = mqtt.connect(connectUrl, options);

    client.on('connect', () => {
        mqttLogger.info('Connected to MQTT broker');
        isConnected = true;
        reconnectAttempts = 0; // Reset reconnect attempts on successful connection

        // Subscribe to all topics
        Object.values(TOPICS).forEach(topic => {
            client.subscribe(topic, (err) => {
                if (err) {
                    mqttLogger.error(`Error subscribing to ${topic}:`, err);
                } else {
                    mqttLogger.info(`Subscribed to ${topic}`);
                }
            });
        });
    });

    client.on('message', async (topic, message) => {
        const messageStr = message.toString();

        // Handle sensor data
        if (topic === TOPICS.TEMPERATURE) {
            const temp = parseFloat(messageStr);
            if (!isNaN(temp)) {
                latestValues.temperature = temp;
                // Store in database using model
                try {
                    await SensorData.create('temperature', temp);
                } catch (err) {
                    mqttLogger.error('Error storing temperature:', err);
                }
            }
        } else if (topic === TOPICS.HUMIDITY) {
            const humidity = parseFloat(messageStr);
            if (!isNaN(humidity)) {
                latestValues.humidity = humidity;
                // Store in database using model
                try {
                    await SensorData.create('humidity', humidity);
                } catch (err) {
                    mqttLogger.error('Error storing humidity:', err);
                }
            }
        } else if (topic === TOPICS.SOIL_MOISTURE) {
            const moisture = parseFloat(messageStr);
            if (!isNaN(moisture)) {
                latestValues.soilMoisture = moisture;
                // Store in database using model
                try {
                    await SensorData.create('soil_moisture', moisture);
                } catch (err) {
                    mqttLogger.error('Error storing soil moisture:', err);
                }
            }
        } else if (topic === TOPICS.SOIL_PH) {
            const ph = parseFloat(messageStr);
            if (!isNaN(ph)) {
                latestValues.soilPH = ph;
                // Store in database using model
                try {
                    await SensorData.create('soil_ph', ph);
                } catch (err) {
                    mqttLogger.error('Error storing soil pH:', err);
                }
            }
        } else if (topic === TOPICS.VALVE_STATUS) {
            const status = messageStr.toLowerCase();
            latestValues.valveStatus = status;
            // Store in DB using model
            try {
                await DeviceLog.create('water_valve', 'status_update', status, 'system');
            } catch (err) {
                mqttLogger.error('Error storing valve status:', err);
            }
        } else if (topic === TOPICS.AUTO_STATUS) {
            const status = messageStr.toLowerCase();
            latestValues.autoStatus = status;
            // Store in DB using model
            try {
                await DeviceLog.create('water_valve', 'auto_control', status, 'system');
            } catch (err) {
                mqttLogger.error('Error storing auto status:', err);
            }
        }
    });

    client.on('error', (err) => {
        mqttLogger.error('MQTT connection error:', err);
        isConnected = false;
        
        // Implement exponential backoff reconnection
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
            mqttLogger.info(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
            
            setTimeout(() => {
                mqttLogger.info('Attempting to reconnect...');
                client.reconnect();
            }, delay);
        } else {
            mqttLogger.error('Max reconnection attempts reached. Please check your connection.');
        }
    });

    client.on('close', () => {
        mqttLogger.info('MQTT connection closed');
        isConnected = false;
        
        // Attempt to reconnect if not intentionally disconnected
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
            mqttLogger.info(`Connection closed. Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
            
            setTimeout(() => {
                mqttLogger.info('Attempting to reconnect...');
                client.reconnect();
            }, delay);
        }
    });
};

// Disconnect from MQTT broker
const disconnect = () => {
    if (client) {
        client.end();
        isConnected = false;
    }
};

// Control the valve
const controlValve = async (status, username) => {
    if (!client || !isConnected) {
        mqttLogger.error('MQTT client not connected');
        return false;
    }

    const action = status ? 'on' : 'off';
    client.publish(TOPICS.VALVE_CONTROL, action);
    mqttLogger.info(`Valve control: ${action} by ${username}`);

    // Log the action using model
    try {
        await DeviceLog.create('water_valve', 'manual_control', action, username);
    } catch (err) {
        mqttLogger.error('Error logging valve control:', err);
    }

    return true;
};

const controlAuto = async (status, username) => {
    if (!client || !isConnected) {
        mqttLogger.error('MQTT client not connected');
        return false;
    }

    const action = status ? 'on' : 'off';
    mqttLogger.info(`Auto control: ${action} by ${username}`);
    client.publish(TOPICS.AUTO_CONTROL, action);

    // Log the action using model
    try {
        await DeviceLog.create('water_valve', 'auto_control', action, username);
    } catch (err) {
        mqttLogger.error('Error logging auto control:', err);
    }

    return true;
};

// Get latest sensor values
const getLatestValues = () => {
    return {
        ...latestValues
    };
};

module.exports = {
    connect,
    disconnect,
    controlValve,
    controlAuto,
    getLatestValues,
    TOPICS
};