/**
 * PM2 Ecosystem Configuration
 * Run: pm2 start ecosystem.config.js
 */

export default {
  apps: [
    {
      name:         'billing-api',
      script:       'src/server.js',
      instances:    2,              // 2 app instances in cluster mode
      exec_mode:    'cluster',
      watch:        false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT:     3000,
      },
      // Graceful reload — zero downtime deploys
      kill_timeout:          5000,
      wait_ready:            true,
      listen_timeout:        10000,
      // Logging
      out_file: './logs/api-out.log',
      error_file: './logs/api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name:      'billing-workers',
      script:    'workers/index.js',
      instances: 1,              // single worker process (BullMQ concurrency handles parallelism)
      exec_mode: 'fork',
      watch:     false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
      out_file:   './logs/worker-out.log',
      error_file: './logs/worker-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};