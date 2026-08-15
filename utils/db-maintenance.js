/**
 * Smart Garden Database Maintenance & Monitoring Script
 * Usage: node utils/db-maintenance.js [command]
 * Commands: stats, clean, vacuum, repair, test-ph
 */

require('dotenv').config();
const {
    getDb,
    getSensorStats,
    checkDatabaseHealth
} = require('./database');

const db = getDb();

// Parse command line arguments
const command = process.argv[2] || 'help';
const options = process.argv.slice(3);

console.log('🛠️  Smart Garden Database Maintenance Tool');
console.log('=' .repeat(50));

async function showStats() {
    console.log('\n📊 Database Statistics:');
    
    try {
        const stats = await getSensorStats();
        
        if (stats.length > 0) {
            console.log('\n📈 Sensor Data Overview:');
            console.log('┌─────────────────┬──────────┬─────────────┬─────────────┬─────────────┬─────────────────────┐');
            console.log('│ Sensor Type     │ Records  │ Avg Value   │ Min Value   │ Max Value   │ Last Record         │');
            console.log('├─────────────────┼──────────┼─────────────┼─────────────┼─────────────┼─────────────────────┤');
            
            stats.forEach(stat => {
                const type = stat.sensor_type.padEnd(15);
                const count = stat.total_records.toString().padStart(8);
                const avg = stat.avg_value.toFixed(2).padStart(11);
                const min = stat.min_value.toFixed(2).padStart(11);
                const max = stat.max_value.toFixed(2).padStart(11);
                const lastRecord = new Date(stat.last_record).toLocaleString('id-ID').padStart(19);
                
                console.log(`│ ${type} │ ${count} │ ${avg} │ ${min} │ ${max} │ ${lastRecord} │`);
            });
            
            console.log('└─────────────────┴──────────┴─────────────┴─────────────┴─────────────┴─────────────────────┘');
        } else {
            console.log('No sensor data found in database');
        }

        // Show recent activity
        console.log('\n🕒 Recent Activity (Last 10 records):');
        db.all(`
            SELECT sensor_type, value, timestamp 
            FROM sensor_data 
            ORDER BY timestamp DESC 
            LIMIT 10
        `, [], (err, rows) => {
            if (err) {
                console.error('Error fetching recent data:', err);
                return;
            }

            if (rows.length > 0) {
                console.log('┌─────────────────┬─────────────┬─────────────────────┐');
                console.log('│ Sensor Type     │ Value       │ Timestamp           │');
                console.log('├─────────────────┼─────────────┼─────────────────────┤');
                
                rows.forEach(row => {
                    const type = row.sensor_type.padEnd(15);
                    let value = row.value.toFixed(2);
                    if (row.sensor_type === 'temperature') value += ' °C';
                    else if (row.sensor_type === 'soil_ph') value += ' pH';
                    else if (row.sensor_type !== 'soil_ph') value += ' %';
                    value = value.padStart(11);
                    const timestamp = new Date(row.timestamp).toLocaleString('id-ID').padStart(19);
                    
                    console.log(`│ ${type} │ ${value} │ ${timestamp} │`);
                });
                
                console.log('└─────────────────┴─────────────┴─────────────────────┘');
            } else {
                console.log('No recent activity found');
            }
        });

    } catch (err) {
        console.error('Error retrieving statistics:', err);
    }
}

function cleanOldData() {
    const days = options[0] || 30;
    console.log(`\n🧹 Cleaning sensor data older than ${days} days...`);
    
    db.run(`
        DELETE FROM sensor_data 
        WHERE timestamp < datetime('now', '-${days} days')
    `, function(err) {
        if (err) {
            console.error('Error cleaning old data:', err);
            return;
        }
        
        console.log(`✓ Removed ${this.changes} old sensor records`);
    });

    db.run(`
        DELETE FROM device_logs 
        WHERE timestamp < datetime('now', '-${days} days')
    `, function(err) {
        if (err) {
            console.error('Error cleaning old logs:', err);
            return;
        }
        
        console.log(`✓ Removed ${this.changes} old log records`);
    });
}

function vacuumDatabase() {
    console.log('\n🗜️  Optimizing database (VACUUM)...');
    
    db.run('VACUUM', function(err) {
        if (err) {
            console.error('Error during VACUUM:', err);
            return;
        }
        
        console.log('✓ Database optimized successfully');
    });
}

async function repairDatabase() {
    console.log('\n🔧 Running database integrity check...');
    
    db.get('PRAGMA integrity_check', [], (err, row) => {
        if (err) {
            console.error('Error during integrity check:', err);
            return;
        }
        
        if (row && row.integrity_check === 'ok') {
            console.log('✓ Database integrity check passed');
        } else {
            console.warn('⚠️  Database integrity issues detected:', row);
        }
    });

    // Check for orphaned records
    db.all(`
        SELECT sensor_type, COUNT(*) as count 
        FROM sensor_data 
        WHERE sensor_type NOT IN ('temperature', 'humidity', 'soil_moisture', 'soil_ph')
        GROUP BY sensor_type
    `, [], (err, rows) => {
        if (err) {
            console.error('Error checking for invalid sensor types:', err);
            return;
        }
        
        if (rows.length > 0) {
            console.warn('⚠️  Found invalid sensor types:');
            rows.forEach(row => {
                console.log(`   ${row.sensor_type}: ${row.count} records`);
            });
            
            console.log('\nTo remove invalid records, run:');
            console.log('node utils/db-maintenance.js clean-invalid');
        } else {
            console.log('✓ All sensor records have valid types');
        }
    });
}

function cleanInvalidData() {
    console.log('\n🧹 Removing invalid sensor data...');
    
    db.run(`
        DELETE FROM sensor_data 
        WHERE sensor_type NOT IN ('temperature', 'humidity', 'soil_moisture', 'soil_ph')
    `, function(err) {
        if (err) {
            console.error('Error removing invalid data:', err);
            return;
        }
        
        console.log(`✓ Removed ${this.changes} invalid sensor records`);
    });
}

function testPhSensor() {
    console.log('\n🧪 pH Sensor Data Analysis:');
    
    db.all(`
        SELECT 
            COUNT(*) as total_records,
            AVG(value) as avg_ph,
            MIN(value) as min_ph,
            MAX(value) as max_ph,
            MIN(timestamp) as first_reading,
            MAX(timestamp) as last_reading
        FROM sensor_data 
        WHERE sensor_type = 'soil_ph'
    `, [], (err, rows) => {
        if (err) {
            console.error('Error analyzing pH data:', err);
            return;
        }
        
        const data = rows[0];
        
        if (data.total_records > 0) {
            console.log(`📊 Total pH readings: ${data.total_records}`);
            console.log(`📊 Average pH: ${data.avg_ph.toFixed(2)}`);
            console.log(`📊 pH Range: ${data.min_ph.toFixed(2)} - ${data.max_ph.toFixed(2)}`);
            console.log(`📊 First reading: ${new Date(data.first_reading).toLocaleString('id-ID')}`);
            console.log(`📊 Last reading: ${new Date(data.last_reading).toLocaleString('id-ID')}`);
            
            // pH categories analysis
            db.all(`
                SELECT 
                    CASE 
                        WHEN value < 5.5 THEN 'Acidic (< 5.5)'
                        WHEN value > 7.5 THEN 'Alkaline (> 7.5)'
                        ELSE 'Neutral (5.5-7.5)'
                    END as ph_category,
                    COUNT(*) as count,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM sensor_data WHERE sensor_type = 'soil_ph'), 1) as percentage
                FROM sensor_data 
                WHERE sensor_type = 'soil_ph'
                GROUP BY ph_category
                ORDER BY count DESC
            `, [], (err, categoryRows) => {
                if (!err && categoryRows.length > 0) {
                    console.log('\n📊 pH Distribution:');
                    categoryRows.forEach(row => {
                        console.log(`   ${row.ph_category}: ${row.count} readings (${row.percentage}%)`);
                    });
                }
            });
            
            // Recent pH trend
            db.all(`
                SELECT value, timestamp 
                FROM sensor_data 
                WHERE sensor_type = 'soil_ph'
                ORDER BY timestamp DESC 
                LIMIT 5
            `, [], (err, recentRows) => {
                if (!err && recentRows.length > 0) {
                    console.log('\n📊 Recent pH Readings:');
                    recentRows.forEach(row => {
                        const status = row.value < 5.5 ? 'Acidic' : row.value > 7.5 ? 'Alkaline' : 'Neutral';
                        console.log(`   ${row.value.toFixed(2)} pH (${status}) - ${new Date(row.timestamp).toLocaleString('id-ID')}`);
                    });
                }
            });
            
        } else {
            console.log('❌ No pH sensor data found');
            console.log('   Make sure ESP32 is sending data to topic: smart-garden/sensors/soil-ph');
        }
    });
}

function showHelp() {
    console.log('\n📖 Available Commands:');
    console.log('┌─────────────────┬─────────────────────────────────────────┐');
    console.log('│ Command         │ Description                             │');
    console.log('├─────────────────┼─────────────────────────────────────────┤');
    console.log('│ stats           │ Show database statistics and activity  │');
    console.log('│ clean [days]    │ Remove data older than N days (30)     │');
    console.log('│ vacuum          │ Optimize database (reclaim space)      │');
    console.log('│ repair          │ Check integrity and find issues        │');
    console.log('│ clean-invalid   │ Remove records with invalid types      │');
    console.log('│ test-ph         │ Analyze pH sensor data                 │');
    console.log('│ help            │ Show this help message                 │');
    console.log('└─────────────────┴─────────────────────────────────────────┘');
    
    console.log('\n💡 Examples:');
    console.log('   node utils/db-maintenance.js stats');
    console.log('   node utils/db-maintenance.js clean 7    # Remove data older than 7 days');
    console.log('   node utils/db-maintenance.js test-ph    # Analyze pH sensor data');
}

// Execute command
switch (command) {
    case 'stats':
        showStats();
        break;
    case 'clean':
        cleanOldData();
        break;
    case 'vacuum':
        vacuumDatabase();
        break;
    case 'repair':
        repairDatabase();
        break;
    case 'clean-invalid':
        cleanInvalidData();
        break;
    case 'test-ph':
        testPhSensor();
        break;
    case 'help':
    default:
        showHelp();
        break;
}

// Close database connection after operations complete
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        }
        process.exit(0);
    });
}, 2000);