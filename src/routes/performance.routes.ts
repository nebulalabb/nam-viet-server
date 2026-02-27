import { Router } from 'express';
import performanceController from '@controllers/performance.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';

/**
 * Performance Monitoring Routes
 *
 * All routes require authentication
 * Some routes require admin privileges
 */

const router = Router();

/**
 * @swagger
 * /api/performance/metrics:
 *   get:
 *     summary: Get performance metrics summary
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 */
router.get('/metrics', authentication, performanceController.getMetrics);

/**
 * @swagger
 * /api/performance/recent:
 *   get:
 *     summary: Get recent request metrics
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Recent requests retrieved successfully
 */
router.get('/recent', authentication, performanceController.getRecentRequests);

/**
 * @swagger
 * /api/performance/slow:
 *   get:
 *     summary: Get slow requests
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: integer
 *           default: 1000
 *     responses:
 *       200:
 *         description: Slow requests retrieved successfully
 */
router.get('/slow', authentication, performanceController.getSlowRequestsList);

/**
 * @swagger
 * /api/performance/health:
 *   get:
 *     summary: System health check
 *     tags: [Performance]
 *     responses:
 *       200:
 *         description: System is healthy
 *       503:
 *         description: System is degraded
 */
router.get('/health', performanceController.healthCheck);

/**
 * @swagger
 * /api/performance/clear:
 *   post:
 *     summary: Clear performance metrics (Admin only)
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics cleared successfully
 */
router.post('/clear', authentication, authorize('view_reports'), performanceController.clearPerformanceMetrics);

export default router;
