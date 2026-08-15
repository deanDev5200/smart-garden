const { getDb } = require('../utils/database');

class DeviceLog {
    static create(deviceName, action, status, performedBy) {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
            db.run(
                'INSERT INTO device_logs (device_name, action, status, performed_by) VALUES (?, ?, ?, ?)',
                [deviceName, action, status, performedBy],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, deviceName, action, status, performedBy });
                    }
                }
            );
        });
    }

    static findByDevice(deviceName, limit = 10) {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
            db.all(
                `SELECT device_name, action, status, performed_by, timestamp
                 FROM device_logs
                 WHERE device_name = ?
                 ORDER BY timestamp DESC
                 LIMIT ?`,
                [deviceName, limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const formattedRows = rows.map(row => ({
                            ...row,
                            timestamp: new Date(row.timestamp + 'Z') // Add 'Z' to treat as UTC
                        }));
                        resolve(formattedRows);
                    }
                }
            );
        });
    }

    static findAll(limit = 10) {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
            db.all(
                `SELECT device_name, action, status, performed_by, timestamp
                 FROM device_logs
                 ORDER BY timestamp DESC
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const formattedRows = rows.map(row => ({
                            ...row,
                            timestamp: new Date(row.timestamp + 'Z') // Add 'Z' to treat as UTC
                        }));
                        resolve(formattedRows);
                    }
                }
            );
        });
    }

    static findByAction(action, limit = 10) {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
            db.all(
                `SELECT device_name, action, status, performed_by, timestamp
                 FROM device_logs
                 WHERE action = ?
                 ORDER BY timestamp DESC
                 LIMIT ?`,
                [action, limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const formattedRows = rows.map(row => ({
                            ...row,
                            timestamp: new Date(row.timestamp + 'Z') // Add 'Z' to treat as UTC
                        }));
                        resolve(formattedRows);
                    }
                }
            );
        });
    }

    static deleteOldData(days = 30) {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
            db.run(
                `DELETE FROM device_logs WHERE timestamp < datetime('now', '-${days} days')`,
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ deleted: this.changes });
                    }
                }
            );
        });
    }

    static getStats() {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
            db.all(`
                SELECT 
                    device_name,
                    action,
                    COUNT(*) as total_actions,
                    MAX(timestamp) as last_action
                FROM device_logs 
                GROUP BY device_name, action
                ORDER BY device_name, action
            `, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

module.exports = DeviceLog;