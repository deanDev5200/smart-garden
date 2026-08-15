/**
 * Smart Garden Dashboard Database Initialization Script
 * Run with: npm run init-db
 */

require('dotenv').config();
const {
    initDb,
    checkDatabaseHealth,
    getSensorStats
} = require('./database');
const path = require('path');
const fs = require('fs');

console.log('🌱 Smart Garden IoT Dashboard - Database Initialization');
console.log('=' .repeat(60));

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    console.log('📁 Creating data directory...');
    fs.mkdirSync(dataDir);
    console.log('✓ Data directory created');
} else {
    console.log('✓ Data directory exists');
}

// Initialize database
console.log('\n📊 Initializing database tables and constraints...');
initDb();

// Wait a bit for database operations to complete, then check health
setTimeout(async () => {
    console.log('\n🔍 Checking database health...');
    try {
        const healthCheck = await checkDatabaseHealth();
        
        console.log('\nDatabase Tables Status:');
        Object.entries(healthCheck).forEach(([table, status]) => {
            if (status.exists) {
                console.log(`✓ ${table}`);
            } else {
                console.log(`✗ ${table} - ${status.error || 'Missing'}`);
            }
        });

        // Show sensor statistics if any data exists
        console.log('\n📈 Sensor Data Statistics:');
        try {
            const stats = await getSensorStats();
            if (stats.length > 0) {
                console.log('┌─────────────────┬──────────┬─────────────┬─────────────┬─────────────┐');
                console.log('│ Sensor Type     │ Records  │ Avg Value   │ Min Value   │ Max Value   │');
                console.log('├─────────────────┼──────────┼─────────────┼─────────────┼─────────────┤');
                
                stats.forEach(stat => {
                    const type = stat.sensor_type.padEnd(15);
                    const count = stat.total_records.toString().padStart(8);
                    const avg = stat.avg_value.toFixed(2).padStart(11);
                    const min = stat.min_value.toFixed(2).padStart(11);
                    const max = stat.max_value.toFixed(2).padStart(11);
                    
                    console.log(`│ ${type} │ ${count} │ ${avg} │ ${min} │ ${max} │`);
                });
                
                console.log('└─────────────────┴──────────┴─────────────┴─────────────┴─────────────┘');
            } else {
                console.log('No sensor data found (this is normal for new installations)');
            }
        } catch (statsErr) {
            console.log('Unable to retrieve sensor statistics:', statsErr.message);
        }

    } catch (err) {
        console.error('Error checking database health:', err);
    }

    // Show configuration summary
    console.log('\n⚙️  Configuration Summary:');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ Smart Garden IoT Dashboard - Configuration                  │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│ Supported Sensors:                                         │');
    console.log('│   • Temperature (°C)                                       │');
    console.log('│   • Humidity (%)                                           │');
    console.log('│   • Soil Moisture (%)                                      │');
    console.log('│   • Soil pH (pH units)                                     │');
    console.log('│                                                             │');
    console.log('│ MQTT Topics:                                                │');
    console.log('│   • smart-garden/sensors/temperature                       │');
    console.log('│   • smart-garden/sensors/humidity                          │');
    console.log('│   • smart-garden/sensors/soil-moisture                     │');
    console.log('│   • smart-garden/sensors/soil-ph                           │');
    console.log('│   • smart-garden/control/valve                             │');
    console.log('│   • smart-garden/status/valve                              │');
    console.log('│                                                             │');
    console.log('│ Default Credentials:                                        │');
    console.log('│   Username: admin                                           │');
    console.log('│   Password: admin123                                        │');
    console.log('│                                                             │');
    console.log('│ ⚠️  IMPORTANT: Change default password after first login!   │');
    console.log('└─────────────────────────────────────────────────────────────┘');

    console.log('\n🎯 Next Steps:');
    console.log('1. Start the application: npm start');
    console.log('2. Access dashboard: http://localhost:3000');
    console.log('3. Login with admin credentials above');
    console.log('4. Change default password in user settings');
    console.log('5. Ensure ESP32 device is configured with correct MQTT topics');
    
    if (process.env.MQTT_HOST) {
        console.log(`6. MQTT Broker: ${process.env.MQTT_HOST}:${process.env.MQTT_PORT || 1883}`);
    }

    console.log('\n✨ Database initialization complete!');
    
}, 1000);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Database initialization interrupted');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n👋 Database initialization terminated');
    process.exit(0);
});