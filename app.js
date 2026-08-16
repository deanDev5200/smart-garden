require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const {
    initDb
} = require('./utils/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { validateConfig } = require('./utils/configValidator');

// Import routes
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const apiRoutes = require('./routes/apiRoutes');

// Import MQTT service
const mqttService = require('./services/mqttService');

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// Validate configuration on startup
try {
    validateConfig();
} catch (error) {
    logger.error('Configuration validation failed, shutting down:', error);
    process.exit(1);
}

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
    hsts: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);
app.use('/login', authLimiter);
app.use('/api/login', authLimiter);

// Data sanitization
app.use(xss());

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// Session setup
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.sqlite',
        dir: './data'
    }),
    secret: process.env.SESSION_SECRET || 'smart-garden-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: false, // Set to false for HTTP, set to true for HTTPS
        httpOnly: true, // Prevent XSS attacks
        sameSite: 'lax' // CSRF protection
    }
}));

// Initialize database
try {
    initDb();
    logger.info('Database initialized successfully');
} catch (error) {
    logger.error('Failed to initialize database:', error);
}

// Initialize MQTT
try {
    mqttService.connect();
    logger.info('MQTT service initialized');
} catch (error) {
    logger.error('Failed to initialize MQTT service:', error);
}

// Global middleware for template variables
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Routes
app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    } else {
        return res.redirect('/login');
    }
});

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});

// Handle process termination
process.on('SIGINT', () => {
    mqttService.disconnect();
    console.log('Disconnected from MQTT broker');
    process.exit(0);
});