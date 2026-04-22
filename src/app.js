  import express from 'express';
  import helmet from 'helmet';
  import cors from 'cors';
  import morgan from 'morgan';
  import cookieParser from 'cookie-parser';
  import { registerRoutes } from './modules/index.js';
  import requestIdMiddleware from './middleware/requestId.middleware.js';
  import errorHandlerMiddleware from './middleware/errorHandler.middleware.js';
  import { generalRateLimiter, authRateLimiter } from './middleware/rateLimiter.middleware.js';
  import logger from './shared/utils/logger.js';
  import config from './config/env.js';

  /**
   * Create Express application
   * Factory pattern for easy testing
   */
  export function createApp() {
    const app = express();

    // ============================================================
    // Security Middleware
    // ============================================================
    
    // Helmet - sets various HTTP headers for security
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }));

    // CORS - configure based on environment
    const corsOptions = {
      origin: config.app.isProduction 
        ? process.env.CORS_ORIGINS?.split(',') || ['https://yourdomain.com']
        : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Idempotency-Key'],
      exposedHeaders: ['X-Request-ID', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    };
    app.use(cors(corsOptions));

    // ============================================================
    // Request Parsing Middleware
    // ============================================================
    
    // Parse JSON bodies
    app.use(express.json({ limit: '10mb' }));
    
    // Parse URL-encoded bodies
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Parse cookies
    app.use(cookieParser());
    
    // Request ID injection (must be early to be used in logs)
    app.use(requestIdMiddleware);

    // ============================================================
    // Logging Middleware
    // ============================================================
    
    // Morgan HTTP request logger with Winston stream
    const morganFormat = config.app.isProduction ? 'combined' : 'dev';
    app.use(morgan(morganFormat, {
      stream: {
        write: (message) => {
          // Remove newline and log as info
          logger.info(message.trim());
        },
      },
      skip: (req) => req.path === '/health',
    }));

    // Custom request logger with request ID
    app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`, {
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      next();
    });

    // ============================================================
    // Rate Limiting
    // ============================================================
    
    // General rate limiter for all API routes
    app.use('/api', generalRateLimiter);
    
    // Stricter rate limiter for auth routes
    app.use('/api/v1/auth', authRateLimiter);

    // ============================================================
    // Health Check Endpoint (no auth required)
    // ============================================================
    
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.app.env,
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    // ============================================================
    // API Routes
    // ============================================================
    
    // Register all module routes
    const routeRegistration = registerRoutes(app, { apiPrefix: '/api/v1' });
    
    logger.info('Routes registered', {
      count: routeRegistration.count,
      routes: routeRegistration.registered,
      prefix: routeRegistration.prefix,
    });

    // ============================================================
    // 404 Handler - Route not found
    // ============================================================
    
    app.use((req, res) => {
      logger.warn('Route not found', {
        method: req.method,
        path: req.path,
        requestId: req.requestId,
      });
      
      res.status(404).json({
        error: 'Route not found',
        code: 'NOT_FOUND',
        path: req.path,
        method: req.method,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      });
    });

    // ============================================================
    // Global Error Handler (must be last)
    // ============================================================
    
    app.use(errorHandlerMiddleware);

    return app;
  }

  export default createApp;