const { getDb } = require('../utils/database');
const bcrypt = require('bcrypt');

class User {
    static create(username, password) {
        return new Promise((resolve, reject) => {
            const hashedPassword = bcrypt.hashSync(password, 10);
            const db = getDb();
            
            db.run(
                'INSERT INTO users (username, password) VALUES (?, ?)',
                [username, hashedPassword],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, username });
                    }
                }
            );
        });
    }

    static findByUsername(username) {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
            db.get(
                'SELECT * FROM users WHERE username = ?',
                [username],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    static findById(id) {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
            db.get(
                'SELECT * FROM users WHERE id = ?',
                [id],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    static updatePassword(id, newPassword) {
        return new Promise((resolve, reject) => {
            const hashedPassword = bcrypt.hashSync(newPassword, 10);
            const db = getDb();
            
            db.run(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedPassword, id],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    static verifyPassword(password, hash) {
        return bcrypt.compareSync(password, hash);
    }

    static getAll() {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
            db.all(
                'SELECT id, username, created_at FROM users ORDER BY created_at DESC',
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    static delete(id) {
        return new Promise((resolve, reject) => {
            const db = getDb();
            
            db.run(
                'DELETE FROM users WHERE id = ?',
                [id],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }
}

module.exports = User;