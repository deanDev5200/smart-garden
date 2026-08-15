const { getDb } = require('../utils/database');

class SensorData {
    static create(sensorType, value) {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
            db.run(
                'INSERT INTO sensor_data (sensor_type, value) VALUES (?, ?)',
                [sensorType, value],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, sensorType, value });
                    }
                }
            );
        });
    }

    static findByType(sensorType, timeRange = 'day') {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
            let timeFilter = '';
            switch (timeRange) {
                case 'hour':
                    timeFilter = `AND timestamp >= datetime('now', '-1 hour')`;
                    break;
                case 'day':
                    timeFilter = `AND timestamp >= datetime('now', '-1 day')`;
                    break;
                case 'week':
                    timeFilter = `AND timestamp >= datetime('now', '-7 days')`;
                    break;
                case 'month':
                    timeFilter = `AND timestamp >= datetime('now', '-30 days')`;
                    break;
                default:
                    timeFilter = `AND timestamp >= datetime('now', '-1 day')`;
            }

            const query = `
                SELECT value, timestamp
                FROM sensor_data
                WHERE sensor_type = ? ${timeFilter}
                ORDER BY timestamp ASC
            `;

            db.all(query, [sensorType], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const data = rows.map(row => ({
                        value: row.value,
                        timestamp: new Date(row.timestamp + 'Z') // Add 'Z' to treat as UTC
                    }));
                    resolve(data);
                }
            });
        });
    }

    static findAll(filters = {}) {
        return new Promise((resolve, reject) => {
            const db = getDb();
            const { type, startDate, endDate, page = 1, limit = 20 } = filters;
            
            const pageNumber = parseInt(page) || 1;
            const limitPerPage = parseInt(limit) || 20;
            const offset = (pageNumber - 1) * limitPerPage;
            
            let params = [];
            let typeFilter = '';
            
            if (type && type !== 'all') {
                typeFilter = 'WHERE sensor_type = ?';
                params.push(type);
            }
            
            let dateFilter = '';
            if (startDate && endDate) {
                dateFilter = type !== 'all' ? ' AND' : ' WHERE';
                dateFilter += ' timestamp BETWEEN ? AND ?';
                params.push(startDate, endDate);
            } else if (startDate) {
                dateFilter = type !== 'all' ? ' AND' : ' WHERE';
                dateFilter += ' timestamp >= ?';
                params.push(startDate);
            } else if (endDate) {
                dateFilter = type !== 'all' ? ' AND' : ' WHERE';
                dateFilter += ' timestamp <= ?';
                params.push(endDate);
            }

            const countQuery = `
                SELECT COUNT(*) as total
                FROM sensor_data
                ${typeFilter}${dateFilter}
            `;

            db.get(countQuery, params, (err, countResult) => {
                if (err) {
                    reject(err);
                    return;
                }

                const total = countResult.total;
                const totalPages = Math.ceil(total / limitPerPage);

                const dataQuery = `
                    SELECT id, sensor_type, value, timestamp
                    FROM sensor_data
                    ${typeFilter}${dateFilter}
                    ORDER BY timestamp DESC
                    LIMIT ? OFFSET ?
                `;

                const dataParams = [...params, limitPerPage, offset];

                db.all(dataQuery, dataParams, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        const formattedData = rows.map(row => ({
                            id: row.id,
                            sensorType: row.sensor_type,
                            value: row.value,
                            timestamp: new Date(row.timestamp + 'Z') // Add 'Z' to treat as UTC
                        }));
                        resolve({
                            data: formattedData,
                            pagination: {
                                currentPage: pageNumber,
                                totalPages,
                                totalItems: total,
                                itemsPerPage: limitPerPage
                            }
                        });
                    }
                });
            });
        });
    }

    static getStats() {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
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
    }

    static deleteOldData(days = 30) {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
            db.run(
                `DELETE FROM sensor_data WHERE timestamp < datetime('now', '-${days} days')`,
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

    static deleteByType(sensorType) {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
            db.run(
                'DELETE FROM sensor_data WHERE sensor_type = ?',
                [sensorType],
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
}

module.exports = SensorData;