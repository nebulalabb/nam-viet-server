import prisma from '../config/prisma';
import { CreateTicketInput, UpdateTicketInput, TicketQueryInput } from '../validators/ticket.validator';
import { NotFoundError } from '../utils/errors';
import { Prisma } from '@prisma/client';
import notificationService from './notification.service';
import { logActivity } from '@utils/logger';

class TicketService {
  // Create new ticket
  async createTicket(userId: number, data: CreateTicketInput) {
    // Generate unique code (Logic: TCK-YYYYMMDD-XXXX)
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Find the last ticket created today to increment sequence
    const lastTicket = await prisma.ticket.findFirst({
        where: {
            ticketCode: {
                startsWith: `TCK-${dateStr}`
            }
        },
        orderBy: {
            ticketCode: 'desc'
        }
    });

    let sequence = 1;
    if (lastTicket) {
        const parts = lastTicket.ticketCode.split('-');
        if (parts.length === 3) {
            sequence = parseInt(parts[2]) + 1;
        }
    }

    const ticketCode = `TCK-${dateStr}-${sequence.toString().padStart(3, '0')}`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketCode,
        title: data.title,
        description: data.description,
        priority: data.priority,
        customerId: data.customerId,
        assignedToId: data.assignedToId,
        createdBy: userId,
      },
      include: {
        customer: true,
        assignedTo: true,
        creator: true,
      },
    });

    // Notify new ticket
    notificationService.notifyNewTicket({
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        title: ticket.title,
        customerName: ticket.customer?.customerName || 'Khách hàng',
        priority: ticket.priority
    }).catch(console.error);

    // Notify assigned
    if (ticket.assignedToId) {
        notificationService.notifyTicketAssigned({
            ticketId: ticket.id,
            ticketCode: ticket.ticketCode,
            title: ticket.title,
            assigneeId: ticket.assignedToId,
            assignerName: ticket.creator?.fullName || 'Hệ thống'
        }).catch(console.error);
    }

    // Log activity
    logActivity('create', userId, 'tickets', {
      recordId: ticket.id,
      newValue: ticket,
    });

    return ticket;
  }

  // Get all tickets with pagination
  async getAllTickets(query: TicketQueryInput) {
    const { page = 1, limit = 10, search, status, priority, customerId, assignedToId, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {
        deletedAt: null, // Only fetch active tickets
    };

    if (search) {
      where.OR = [
        { ticketCode: { contains: search } },
        { title: { contains: search } },
        { description: { contains: search } },
        { customer: { customerName: { contains: search } } }, // Search by customer name
      ];
    }

    if (status && status !== 'all') {
      where.status = status as any;
    }

    if (priority) {
      where.priority = priority;
    }

    if (customerId) {
        where.customerId = customerId;
    }

    if (assignedToId) {
        where.assignedToId = assignedToId;
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: { select: { id: true, customerName: true, phone: true } },
          assignedTo: { select: { id: true, fullName: true, email: true } },
          creator: { select: { id: true, fullName: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return {
      tickets,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get ticket by ID
  async getTicketById(id: number) {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        customer: true,
        assignedTo: true,
        creator: true,
        tasks: true, // Include related tasks
      },
    });

    if (!ticket || ticket.deletedAt) {
      throw new NotFoundError('Phiếu hỗ trợ không tồn tại');
    }

    return ticket;
  }

  // Update ticket
  async updateTicket(id: number, data: UpdateTicketInput, updatedBy?: number) {
    const oldTicket = await this.getTicketById(id);

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        ...data,
      },
      include: {
        customer: true,
        assignedTo: true,
      },
    });

    // Notify Status Change
    if (updatedTicket.status !== oldTicket.status) {
        notificationService.notifyTicketStatusChange({
            ticketId: updatedTicket.id,
            ticketCode: updatedTicket.ticketCode,
            title: updatedTicket.title,
            oldStatus: oldTicket.status,
            newStatus: updatedTicket.status,
            creatorId: oldTicket.createdBy,
            updaterName: 'Hệ thống' 
        }).catch(console.error);
    }

    // Notify Assignee Change
    if (updatedTicket.assignedToId && updatedTicket.assignedToId !== oldTicket.assignedToId) {
        notificationService.notifyTicketAssigned({
            ticketId: updatedTicket.id,
            ticketCode: updatedTicket.ticketCode,
            title: updatedTicket.title,
            assigneeId: updatedTicket.assignedToId,
            assignerName: 'Hệ thống'
        }).catch(console.error);
    }

    // Log activity
    if (updatedBy) {
        logActivity('update', updatedBy, 'tickets', {
            recordId: id,
            oldValue: oldTicket,
            newValue: updatedTicket,
        });
    }

    return updatedTicket;
  }

  // Delete ticket (Soft Delete)
  async deleteTicket(id: number, deletedBy?: number) {
    const ticket = await this.getTicketById(id);
    
    // Soft delete
    await prisma.ticket.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    // Log activity
    if (deletedBy) {
        logActivity('delete', deletedBy, 'tickets', {
            recordId: id,
            oldValue: ticket,
        });
    }
    
    return { message: 'Xóa phiếu hỗ trợ thành công' };
  }
}

export default new TicketService();
