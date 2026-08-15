const User = require('../models/User');
const logger = require('../utils/logger');

// Render login page
const getLogin = (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('auth/login', {
        title: 'Login',
        error: null
    });
};

// Process login
const postLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findByUsername(username);

        if (!user) {
            return res.render('auth/login', {
                title: 'Login',
                error: 'Username atau password salah'
            });
        }

        // Compare passwords
        const isMatch = User.verifyPassword(password, user.password);

        if (!isMatch) {
            return res.render('auth/login', {
                title: 'Login',
                error: 'Username atau password salah'
            });
        }

        // Create session
        req.session.user = {
            id: user.id,
            username: user.username
        };

        res.redirect('/dashboard');
    } catch (error) {
        logger.error('Login error:', error);
        return res.render('auth/login', {
            title: 'Login',
            error: 'Terjadi kesalahan pada server'
        });
    }
};

// Render change password page
const getChangePassword = (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    res.render('auth/change-password', {
        title: 'Ganti Password',
        error: null,
        success: null
    });
};

// Process change password
const postChangePassword = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.render('auth/change-password', {
                title: 'Ganti Password',
                error: 'Semua field harus diisi',
                success: null
            });
        }

        if (newPassword !== confirmPassword) {
            return res.render('auth/change-password', {
                title: 'Ganti Password',
                error: 'Password baru tidak cocok dengan konfirmasi',
                success: null
            });
        }

        if (newPassword.length < 6) {
            return res.render('auth/change-password', {
                title: 'Ganti Password',
                error: 'Password baru harus minimal 6 karakter',
                success: null
            });
        }

        // Get user from database
        const user = await User.findById(req.session.user.id);

        if (!user) {
            req.session.destroy();
            return res.redirect('/login');
        }

        // Verify current password
        const isMatch = User.verifyPassword(currentPassword, user.password);

        if (!isMatch) {
            return res.render('auth/change-password', {
                title: 'Ganti Password',
                error: 'Password saat ini tidak valid',
                success: null
            });
        }

        // Update password in database
        await User.updatePassword(user.id, newPassword);

        return res.render('auth/change-password', {
            title: 'Ganti Password',
            error: null,
            success: 'Password berhasil diubah'
        });
    } catch (error) {
        logger.error('Password change error:', error);
        return res.render('auth/change-password', {
            title: 'Ganti Password',
            error: 'Terjadi kesalahan pada server',
            success: null
        });
    }
};

// Logout
const logout = (req, res) => {
    const username = req.session.user?.username || 'unknown';
    req.session.destroy((err) => {
        if (err) {
            logger.error('Session destruction error:', err);
        } else {
            logger.info(`User ${username} logged out`);
        }
        res.redirect('/login');
    });
};

module.exports = {
    getLogin,
    postLogin,
    getChangePassword,
    postChangePassword,
    logout
};