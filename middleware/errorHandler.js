// Global error handling middleware

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: err.errors
        });
    }

    // Handle database errors
    if (err.code && err.code.startsWith('SQLITE_')) {
        return res.status(500).json({
            success: false,
            error: 'Database error',
            message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred while processing your request'
        });
    }

    // Handle JWT/session errors
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'You are not authorized to access this resource'
        });
    }

    // Handle rate limit errors
    if (err.name === 'RateLimitError') {
        return res.status(429).json({
            success: false,
            error: 'Too many requests',
            message: err.message
        });
    }

    // Default error response
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

// 404 handler
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
        message: `Route ${req.originalUrl} not found`
    });
};

// Async handler wrapper to catch async errors
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler
};
