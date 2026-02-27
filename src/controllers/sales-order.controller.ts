import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import salesOrderService from '@services/sales-order.service';

class SalesOrderController {
  // GET /api/sales-orders - Get all sales orders
  async getAll(req: AuthRequest, res: Response) {
    const result = await salesOrderService.getAll(req.query as any);

    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
      statistics: result.statistics,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/sales-orders/:id - Get sales order by ID
  async getById(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const order = await salesOrderService.getById(id);

    res.status(200).json({
      success: true,
      data: order,
      timestamp: new Date().toISOString(),
    });
  }

  // POST /api/sales-orders - Create new sales order
  async create(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const result = await salesOrderService.create(req.body, userId);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Tạo đơn hàng bán thành công',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/sales-orders/:id - Update sales order
  async update(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const order = await salesOrderService.update(id, req.body, userId);

    res.status(200).json({
      success: true,
      data: order,
      message: 'Cập nhật đơn hàng bán thành công',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/sales-orders/:id/approve - Approve order
  async approve(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const order = await salesOrderService.approve(id, userId, req.body);

    res.status(200).json({
      success: true,
      data: order,
      message: 'Phê duyệt đơn hàng bán thành công',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/sales-orders/:id/complete - Complete order
  async complete(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const order = await salesOrderService.complete(id, userId);

    res.status(200).json({
      success: true,
      data: order,
      message:
        'Hoàn thành đơn hàng bán thành công. Tồn kho đã được cập nhật và công nợ khách hàng đã được ghi nhận.',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/sales-orders/:id/cancel - Cancel order
  async cancel(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const order = await salesOrderService.cancel(id, userId, req.body);

    res.status(200).json({
      success: true,
      data: order,
      message: 'Hủy đơn hàng bán thành công. Tồn kho đã được giải phóng.',
      timestamp: new Date().toISOString(),
    });
  }

  // POST /api/sales-orders/:id/payment - Process payment
  async processPayment(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const order = await salesOrderService.processPayment(id, userId, req.body);

    res.status(200).json({
      success: true,
      data: order,
      message: 'Xử lý thanh toán thành công',
      timestamp: new Date().toISOString(),
    });
  }

  // DELETE /api/sales-orders/:id - Delete order
  async delete(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const result = await salesOrderService.delete(id, userId);

    res.status(200).json({
      success: true,
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  }

}

export default new SalesOrderController();
