const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Database setup
const dbPath = path.join(dataDir, 'smart_garden.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schemas
const initDb = () => {
    console.log('Initializing Smart Garden Database...');
    
    // Use serialize to ensure operations run in sequence
    db.serialize(() => {
        // Create Users table first
        db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
            if (err) {
                console.error('Error creating users table:', err);
            } else {
                console.log('✓ Users table ready');
            }
        });

        // Create SensorData table with proper constraints for pH support
        db.run(`
        CREATE TABLE IF NOT EXISTS sensor_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sensor_type TEXT NOT NULL CHECK(sensor_type IN ('temperature', 'humidity', 'soil_moisture', 'soil_ph')),
          value REAL NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
            if (err) {
                console.error('Error creating sensor_data table:', err);
            } else {
                console.log('✓ Sensor data table ready (supports: temperature, humidity, soil_moisture, soil_ph)');
            }
        });

        // Create DeviceLog table
        db.run(`
        CREATE TABLE IF NOT EXISTS device_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_name TEXT NOT NULL,
          action TEXT NOT NULL,
          status TEXT NOT NULL,
          performed_by TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
            if (err) {
                console.error('Error creating device_logs table:', err);
            } else {
                console.log('✓ Device logs table ready');
            }
        });

        // Create indexes after tables are created
        db.run(`
        CREATE INDEX IF NOT EXISTS idx_sensor_data_type_timestamp 
        ON sensor_data(sensor_type, timestamp)
      `, (err) => {
            if (err) {
                console.error('Error creating sensor_data type+timestamp index:', err);
            } else {
                console.log('✓ Sensor data type+timestamp index created');
            }
        });

        db.run(`
        CREATE INDEX IF NOT EXISTS idx_sensor_data_timestamp 
        ON sensor_data(timestamp)
      `, (err) => {
            if (err) {
                console.error('Error creating sensor_data timestamp index:', err);
            } else {
                console.log('✓ Sensor data timestamp index created');
            }
        });

        db.run(`
        CREATE INDEX IF NOT EXISTS idx_device_logs_device_timestamp 
        ON device_logs(device_name, timestamp)
      `, (err) => {
            if (err) {
                console.error('Error creating device_logs index:', err);
            } else {
                console.log('✓ Device logs index created');
            }
        });

        // Check and create admin user after all tables are ready
        db.get(`SELECT * FROM users WHERE username = 'admin'`, [], (err, row) => {
            if (err) {
                console.error('Error checking for admin user:', err);
                return;
            }

            if (!row) {
                // Create default admin user
                const hashedPassword = bcrypt.hashSync('admin123', 10);
                db.run(
                    `INSERT INTO users (username, password) VALUES (?, ?)`,
                    ['admin', hashedPassword],
                    (err) => {
                        if (err) {
                            console.error('Error creating admin user:', err);
                            return;
                        }
                        console.log('✓ Default admin user created');
                        console.log('  Username: admin');
                        console.log('  Password: admin123');
                        console.log('  ⚠️  Please change this password after first login!');
                    }
                );
            } else {
                console.log('✓ Admin user already exists');
            }
        });

        // Run migration check after all tables are created
        setTimeout(() => {
            migrateExistingData();
        }, 500);
    });
};

// Function to migrate existing data to support pH sensor
const migrateExistingData = () => {
    // Check if we need to add CHECK constraint to existing table
    db.all(`PRAGMA table_info(sensor_data)`, [], (err, columns) => {
        if (err) {
            console.error('Error checking table schema:', err);
            return;
        }

        // Test constraint by trying to insert invalid data
        db.run(`INSERT INTO sensor_data (sensor_type, value) VALUES (?, ?)`, 
            ['test_invalid_sensor', 0], 
            function(err) {
                if (err && err.message.includes('CHECK constraint failed')) {
                    console.log('✓ Sensor type constraints already in place');
                } else if (!err) {
                    // The invalid data was inserted, so constraints are missing
                    console.log('⚠️  Adding sensor type constraints...');
                    
                    // Delete the test record
                    db.run(`DELETE FROM sensor_data WHERE sensor_type = 'test_invalid_sensor'`);
                    
                    // Recreate table with constraints
                    recreateTableWithConstraints();
                } else {
                    console.log('✓ Sensor type constraints verified');
                }
                
                // Clean up any test records
                db.run(`DELETE FROM sensor_data WHERE sensor_type = 'test_invalid_sensor'`);
            }
        );
    });
};

// Recreate table with proper constraints
const recreateTableWithConstraints = () => {
    db.serialize(() => {
        console.log('🔄 Recreating sensor_data table with proper constraints...');
        
        // Backup existing data
        db.run(`CREATE TABLE sensor_data_backup AS SELECT * FROM sensor_data WHERE 1=0`);
        
        db.run(`INSERT INTO sensor_data_backup SELECT * FROM sensor_data`);
        
        // Drop old table
        db.run(`DROP TABLE sensor_data`);
        
        // Create new table with constraints
        db.run(`
        CREATE TABLE sensor_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sensor_type TEXT NOT NULL CHECK(sensor_type IN ('temperature', 'humidity', 'soil_moisture', 'soil_ph')),
          value REAL NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Restore valid data only
        db.run(`
        INSERT INTO sensor_data (sensor_type, value, timestamp) 
        SELECT sensor_type, value, timestamp 
        FROM sensor_data_backup 
        WHERE sensor_type IN ('temperature', 'humidity', 'soil_moisture', 'soil_ph')
        `);
        
        // Recreate indexes
        db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_data_type_timestamp ON sensor_data(sensor_type, timestamp)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_data_timestamp ON sensor_data(timestamp)`);
        
        // Drop backup table
        db.run(`DROP TABLE sensor_data_backup`);
        
        console.log('✓ Table schema updated with sensor type constraints');
    });
};

// Function to check database health
const checkDatabaseHealth = () => {
    return new Promise((resolve, reject) => {
        // Check if all required tables exist
        const requiredTables = ['users', 'sensor_data', 'device_logs'];
        let tablesChecked = 0;
        const results = {};

        requiredTables.forEach(tableName => {
            db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, row) => {
                if (err) {
                    results[tableName] = { exists: false, error: err.message };
                } else {
                    results[tableName] = { exists: !!row };
                }
                
                tablesChecked++;
                if (tablesChecked === requiredTables.length) {
                    resolve(results);
                }
            });
        });
    });
};

// Function to get sensor statistics
const getSensorStats = () => {
    return new Promise((resolve, reject) => {
        db.all(`
        SELECT 
            sensor_type,
            COUNT(*) as total_records,
            MIN(timestamp) as first_record,
            MAX(timestamp) as last_record,
            AVG(value) as avg_value,
            MIN(value) as min_value,
            MAX(value) as max_value
        FROM sensor_data 
        GROUP BY sensor_type
        ORDER BY sensor_type
        `, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// Function to test database connection
const testConnection = () => {
    return new Promise((resolve, reject) => {
        db.get('SELECT 1 as test', [], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row.test === 1);
            }
        });
    });
};

// Get database connection
const getDb = () => db;

module.exports = {
    initDb,
    getDb,
    checkDatabaseHealth,
    getSensorStats,
    testConnection
};