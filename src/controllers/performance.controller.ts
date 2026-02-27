import { Request, Response } from 'express';
import {
  getRecentMetrics,
  getSlowRequests,
  getAverageResponseTime,
  getMetricsSummary,
  clearMetrics,
} from '@utils/performance.monitor';
import { getDatabaseMetrics } from '@config/prisma';

/**
 * Performance Monitoring Controller
 *
 * Provides endpoints to monitor application performance:
 * - Request metrics
 * - Slow requests
 * - Database health
 * - Memory usage
 */

class PerformanceController {
  /**
   * Get performance metrics summary
   * GET /api/performance/metrics
   */
  async getMetrics(_req: Request, res: Response): Promise<void> {
    try {
      const summary = getMetricsSummary();

      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve performance metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get recent request metrics
   * GET /api/performance/recent?limit=100
   */
  async getRecentRequests(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 100;
      const metrics = getRecentMetrics(limit);

      res.json({
        success: true,
        data: {
          count: metrics.length,
          metrics,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve recent requests',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get slow requests
   * GET /api/performance/slow?threshold=1000
   */
  async getSlowRequestsList(req: Request, res: Response): Promise<void> {
    try {
      const threshold = parseInt(req.query.threshold as string, 10) || 1000;
      const slowRequests = getSlowRequests(threshold);

      res.json({
        success: true,
        data: {
          threshold: `${threshold}ms`,
          count: slowRequests.length,
          requests: slowRequests,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve slow requests',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get system health check
   * GET /api/performance/health
   */
  async healthCheck(_req: Request, res: Response): Promise<void> {
    try {
      // Check database
      const dbMetrics = await getDatabaseMetrics();

      // Memory usage
      const memoryUsage = process.memoryUsage();
      const memory = {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      };

      // Uptime
      const uptime = process.uptime();
      const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

      const status = dbMetrics.connected ? 'healthy' : 'degraded';

      res.status(dbMetrics.connected ? 200 : 503).json({
        success: true,
        data: {
          status,
          timestamp: new Date().toISOString(),
          uptime: uptimeFormatted,
          services: {
            database: {
              connected: dbMetrics.connected,
              status: dbMetrics.connected ? 'ok' : 'error',
            },
          },
          memory,
          performance: {
            avgResponseTime: `${getAverageResponseTime()}ms`,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Clear performance metrics (admin only)
   * POST /api/performance/clear
   */
  async clearPerformanceMetrics(_req: Request, res: Response): Promise<void> {
    try {
      clearMetrics();

      res.json({
        success: true,
        message: 'Performance metrics cleared successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to clear metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export default new PerformanceController();
