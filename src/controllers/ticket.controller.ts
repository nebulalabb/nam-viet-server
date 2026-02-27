import { Response } from 'express';
import { AuthRequest, ApiResponse } from '@custom-types/common.type';
import ticketService from '@services/ticket.service';
import {
  CreateTicketInput,
  UpdateTicketInput,
  TicketQueryInput,
} from '@validators/ticket.validator';

class TicketController {
  // GET /api/tickets - Get all tickets with pagination & filters
  async getAllTickets(req: AuthRequest, res: Response) {
    const query = req.query as unknown as TicketQueryInput;

    const result = await ticketService.getAllTickets(query);

    const response: ApiResponse = {
      success: true,
      data: result.tickets,
      meta: {
        page: result.meta.page,
        limit: result.meta.limit,
        total: result.meta.total,
        totalPage: result.meta.totalPages,
      },
      message: 'Lấy danh sách phiếu hỗ trợ thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // GET /api/tickets/:id - Get ticket by ID
  async getTicketById(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);

    const ticket = await ticketService.getTicketById(id);

    const response: ApiResponse = {
      success: true,
      data: ticket,
      message: 'Lấy thông tin phiếu hỗ trợ thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // POST /api/tickets - Create new ticket
  async createTicket(req: AuthRequest, res: Response) {
    const data = req.body as CreateTicketInput;
    const userId = req.user!.id;

    const ticket = await ticketService.createTicket(userId, data);

    const response: ApiResponse = {
      success: true,
      data: ticket,
      message: 'Tạo phiếu hỗ trợ thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }

  // PUT /api/tickets/:id - Update ticket
  async updateTicket(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const data = req.body as UpdateTicketInput;
    const userId = req.user!.id; // Get updater ID for logging

    const ticket = await ticketService.updateTicket(id, data, userId);

    const response: ApiResponse = {
      success: true,
      data: ticket,
      message: 'Cập nhật phiếu hỗ trợ thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }

  // DELETE /api/tickets/:id - Delete ticket
  async deleteTicket(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id; // Get deleter ID for logging

    await ticketService.deleteTicket(id, userId);

    const response: ApiResponse = {
      success: true,
      message: 'Xóa phiếu hỗ trợ thành công!',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  }
}

export default new TicketController();
