import { Router } from 'express';
import ticketController from '@controllers/ticket.controller';
import { authentication } from '@middlewares/auth';
import { authorize } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import { logActivityMiddleware } from '@middlewares/logger';
import {
  createTicketSchema,
  updateTicketSchema,
  queryTicketsSchema,
} from '@validators/ticket.validator';

const router = Router();

// All routes require authentication
router.use(authentication);

// GET /api/tickets - Get all tickets (with filtering)
router.get(
  '/',
  authorize('view_tickets'),
  validate(queryTicketsSchema, 'query'),
  asyncHandler(ticketController.getAllTickets.bind(ticketController))
);

// GET /api/tickets/:id - Get ticket by ID
router.get(
  '/:id',
  authorize('view_tickets'),
  asyncHandler(ticketController.getTicketById.bind(ticketController))
);

// POST /api/tickets - Create new ticket
router.post(
  '/',
  authorize('create_ticket'),
  validate(createTicketSchema),
  logActivityMiddleware('create', 'ticket'),
  asyncHandler(ticketController.createTicket.bind(ticketController))
);

// PUT /api/tickets/:id - Update ticket
router.put(
  '/:id',
  authorize('update_ticket'),
  validate(updateTicketSchema),
  logActivityMiddleware('update', 'ticket'),
  asyncHandler(ticketController.updateTicket.bind(ticketController))
);

// DELETE /api/tickets/:id - Delete ticket
router.delete(
  '/:id',
  authorize('delete_ticket'),
  logActivityMiddleware('delete', 'ticket'),
  asyncHandler(ticketController.deleteTicket.bind(ticketController))
);

export default router;
