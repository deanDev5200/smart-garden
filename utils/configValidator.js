const logger = require('./logger');

// Required environment variables
const requiredEnvVars = [
    'SESSION_SECRET',
    'MQTT_HOST',
    'MQTT_USERNAME',
    'MQTT_PASSWORD'
];

// Optional environment variables with defaults
const optionalEnvVars = {
    'PORT': '3000',
    'NODE_ENV': 'development',
    'MQTT_PORT': '1883',
    'MQTT_USE_SSL': 'false',
    'DB_PATH': './data/smart_garden.db'
};

// Validate environment variables
const validateConfig = () => {
    const errors = [];
    const warnings = [];

    // Check required environment variables
    requiredEnvVars.forEach(envVar => {
        if (!process.env[envVar]) {
            errors.push(`Missing required environment variable: ${envVar}`);
        }
    });

    // Validate PORT
    if (process.env.PORT) {
        const port = parseInt(process.env.PORT);
        if (isNaN(port) || port < 1 || port > 65535) {
            errors.push('PORT must be a valid number between 1 and 65535');
        }
    }

    // Validate MQTT_PORT
    if (process.env.MQTT_PORT) {
        const mqttPort = parseInt(process.env.MQTT_PORT);
        if (isNaN(mqttPort) || mqttPort < 1 || mqttPort > 65535) {
            errors.push('MQTT_PORT must be a valid number between 1 and 65535');
        }
    }

    // Validate MQTT_USE_SSL
    if (process.env.MQTT_USE_SSL) {
        const sslValue = process.env.MQTT_USE_SSL.toLowerCase();
        if (sslValue !== 'true' && sslValue !== 'false') {
            errors.push('MQTT_USE_SSL must be either "true" or "false"');
        }
    }

    // Validate NODE_ENV
    if (process.env.NODE_ENV) {
        const validEnvs = ['development', 'production', 'test'];
        if (!validEnvs.includes(process.env.NODE_ENV)) {
            warnings.push(`NODE_ENV should be one of: ${validEnvs.join(', ')}`);
        }
    }

    // Validate MQTT_HOST format
    if (process.env.MQTT_HOST) {
        const host = process.env.MQTT_HOST;
        // Basic validation for hostname or IP
        const hostRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$|^(\d{1,3}\.){3}\d{1,3}$/;
        if (!hostRegex.test(host)) {
            warnings.push('MQTT_HOST format may be invalid');
        }
    }

    // Validate SESSION_SECRET strength
    if (process.env.SESSION_SECRET) {
        if (process.env.SESSION_SECRET.length < 16) {
            warnings.push('SESSION_SECRET should be at least 16 characters for security');
        }
        if (process.env.SESSION_SECRET === 'smart-garden-secret') {
            warnings.push('SESSION_SECRET is using default value, please change it in production');
        }
    }

    // Validate DB_PATH
    if (process.env.DB_PATH) {
        const path = require('path');
        const fs = require('fs');
        const dbDir = path.dirname(process.env.DB_PATH);
        
        if (!fs.existsSync(dbDir)) {
            warnings.push(`Database directory does not exist: ${dbDir}`);
        }
    }

    // Log validation results
    if (errors.length > 0) {
        logger.error('Configuration validation failed:');
        errors.forEach(error => logger.error(`  - ${error}`));
        throw new Error('Configuration validation failed');
    }

    if (warnings.length > 0) {
        logger.warn('Configuration warnings:');
        warnings.forEach(warning => logger.warn(`  - ${warning}`));
    }

    if (errors.length === 0 && warnings.length === 0) {
        logger.info('Configuration validation passed');
    }

    // Log configuration summary (without sensitive data)
    logger.info('Configuration summary:', {
        PORT: process.env.PORT || optionalEnvVars.PORT,
        NODE_ENV: process.env.NODE_ENV || optionalEnvVars.NODE_ENV,
        MQTT_HOST: process.env.MQTT_HOST,
        MQTT_PORT: process.env.MQTT_PORT || optionalEnvVars.MQTT_PORT,
        MQTT_USE_SSL: process.env.MQTT_USE_SSL || optionalEnvVars.MQTT_USE_SSL,
        DB_PATH: process.env.DB_PATH || optionalEnvVars.DB_PATH,
        SESSION_SECRET: process.env.SESSION_SECRET ? '***SET***' : '***NOT SET***'
    });

    return true;
};

module.exports = { validateConfig };
