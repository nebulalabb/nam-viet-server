import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import qrCodeService from '@services/qr-code.service';

class QRCodeController {
  /**
   * POST /api/attendance/qr/generate
   * Generate QR code for attendance
   */
  async generate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate, shift, type } = req.body;
      const userId = req.user!.id;
      
      const result = await qrCodeService.generateQRCode(
        new Date(startDate),
        new Date(endDate),
        userId,
        shift,
        type
      );
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'Tạo QR code thành công',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
  
  /**
   * POST /api/attendance/qr/scan
   * Scan QR code and perform check-in
   */
  async scan(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { qrData, location } = req.body;
      const userId = req.user!.id;
      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');
      
      const result = await qrCodeService.scanQRCode(
        qrData,
        userId,
        location,
        ipAddress,
        userAgent
      );
      
      res.json({
        success: true,
        data: result.attendance,
        message: result.message,
        isLate: result.isLate,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
  
  /**
   * GET /api/attendance/qr
   * Get all QR codes with pagination
   */
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20' } = req.query;
      const result = await qrCodeService.getAll(
        parseInt(page as string),
        parseInt(limit as string)
      );
      
      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
  
  /**
   * GET /api/attendance/qr/:id
   * Get QR code by ID
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const result = await qrCodeService.getById(id);
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
  
  /**
   * PUT /api/attendance/qr/:id/deactivate
   * Deactivate QR code
   */
  async deactivate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      
      const result = await qrCodeService.deactivate(id, userId);
      
      res.json({
        success: true,
        data: result,
        message: 'Đã vô hiệu hóa QR code',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
  
  /**
   * DELETE /api/attendance/qr/:id
   * Delete QR code (soft delete)
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      
      const result = await qrCodeService.delete(id, userId);
      
      res.json({
        success: true,
        data: result,
        message: 'Đã xóa QR code thành công',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}

export default new QRCodeController();
