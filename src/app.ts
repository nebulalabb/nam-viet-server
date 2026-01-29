import express, { Application } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';

import { errorHandler, notFoundHandler } from '@middlewares/errorHandler';
import { globalRateLimiter } from '@middlewares/rateLimiter';
import { sanitizeInput } from '@middlewares/validate';
import compressionMiddleware from '@middlewares/compression';
import { requestTimer } from '@middlewares/logger';

// import { performanceMonitor } from '@utils/performance.monitor';
import RedisService from '@services/redis.service';
import uploadService from '@services/upload.service';
import { setupSwagger } from '@config/swagger';
import { connectDatabase } from '@config/prisma';

// Import routes
import authRoutes from '@routes/auth.routes';
import userRoutes from '@routes/user.routes';
import roleRoutes from '@routes/role.routes';
import permissionRoutes from '@routes/permission.routes';
import warehouseRoutes from '@routes/warehouse.routes';
import categoryRoutes from '@routes/category.routes';
import supplierRoutes from '@routes/supplier.routes';
import purchaseOrderRoutes from '@routes/purchase-order.routes';
import productRoutes from '@routes/product.routes';
import inventoryRoutes from '@routes/inventory.routes';
import stockTransactionRoutes from '@routes/stock-transaction.routes';
import stockTransferRoutes from '@routes/stock-transfer.routes';
import bomRoutes from '@routes/bom.routes';
import productionOrderRoutes from '@routes/production-order.routes';
import customerRoutes from '@routes/customer.routes';
import salesOrderRoutes from '@routes/sales-order.routes';
import deliveryRoutes from '@routes/delivery.routes';
import paymentReceiptRoutes from '@routes/payment-receipt.routes';
import paymentVoucherRoutes from '@routes/payment-voucher.routes';
// import debtReconciliationRoutes from '@routes/debt-reconciliation.routes';
import cashFundRoutes from '@routes/cash-fund.routes';
import promotionRoutes from '@routes/promotion.routes';
import attendanceRoutes from '@routes/attendance.routes';
import salaryRoutes from '@routes/salary.routes';
import notificationRoutes from '@routes/notification.routes';
import reportRoutes from '@routes/report.routes';
import financeRoutes from '@routes/finance.routes';
import productionReportRoutes from '@routes/production-report.routes';
import performanceRoutes from '@routes/performance.routes';
import securityRoutes from '@routes/security.routes';
import generalSettingRoutes from '@routes/general-setting.routes';
import loginHistoryRoutes from '@routes/login-history.routes';

import smartDebtRoutes from '@routes/smart-debt.routes';
import cs_authRoutes from '@routes/cs-auth.routes';
import cs_categoryRoutes from '@routes/cs-category.routes';
import cs_productRoutes from '@routes/cs-product.routes';
import cs_inventoryRoutes from '@routes/cs-inventory.routes';
import cs_customerRoutes from '@routes/cs-customer.routes';
import cs_warehouseRoutes from '@routes/cs-warehouse.routes';
import cs_salesOrderRoutes from '@routes/cs-sales-order.routes';
import cs_product_Routes from '@routes/cs-product.routes';

// News routes
import newsRoutes from '@routes/news.routes';
import newsCategoryRoutes from '@routes/news-category.routes';

// Contact routes
import contactRoutes from '@routes/contact.routes';

// Import notification scheduler
import notificationScheduler from '@schedulers/notification.scheduler';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Khởi tạo Redis
const initializeRedis = async () => {
  try {
    const redis = RedisService.getInstance();
    await redis.initialize();
    console.log('✅ Redis đã kết nối thành công');
  } catch (error) {
    console.error('❌ Redis kết nối thất bại:', error);
    console.log('⚠️  Server sẽ tiếp tục mà không có Redis (vô hiệu hóa cache)');
  }
};

// Khởi tạo thư mục tải lên
const initializeUploads = async () => {
  try {
    await uploadService.ensureUploadDirs();
    console.log('✅ Upload directories initialized');
  } catch (error) {
    console.error('❌ Failed to initialize upload directories:', error);
  }
};

// Middleware
// Phục vụ các tệp tĩnh (upload) TRƯỚC các tiêu đề bảo mật để CORS hoạt động
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
  },
  express.static(path.join(process.cwd(), 'uploads'))
);

app.use(express.static(path.join(__dirname, '../public')));

// Bảo mật nâng cao Headers (áp dụng SAU static files)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:', 'http://localhost:5000'],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 năm
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny', // X-Frame-Options: DENY
    },
    crossOriginResourcePolicy: false, // Vô hiệu hóa CORP để cho CORS hoạt động
    noSniff: true, // X-Content-Type-Options: nosniff
    xssFilter: true, // X-XSS-Protection: 1; mode=block
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-XSRF-Token'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 600, // 10 phút
  })
);

// Tối ưu hóa hiệu xuất
app.use(compressionMiddleware); // Nén phản hồi (gzip)
app.use(requestTimer);
// app.use(httpLogger);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(morgan('dev'));

// Middleware bảo mật
app.use(globalRateLimiter); // Rate limiting
app.use(sanitizeInput); // XSS protection

// Setup Swagger documentation
setupSwagger(app);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    enviroment: process.env.NODE_ENV || 'development',
  });
});

app.get('/api', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Quản Lý Bán Hàng API',
    version: '1.0.0',
    documentation: '/api-docs',
  });
});

// API Routes
// Public routes (no authentication required)
app.use('/api/contact', contactRoutes);

// Protected routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stock-transactions', stockTransactionRoutes);
app.use('/api/stock-transfers', stockTransferRoutes);
app.use('/api/bom', bomRoutes);
app.use('/api/production-orders', productionOrderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/payment-receipts', paymentReceiptRoutes);
app.use('/api/payment-vouchers', paymentVoucherRoutes);
// app.use('/api/debt-reconciliation', debtReconciliationRoutes);
app.use('/api/cash-fund', cashFundRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/reports', productionReportRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/settings/general', generalSettingRoutes);
app.use('/api/settings/login-history', loginHistoryRoutes);

// Smart Debt routes
app.use('/api/smart-debt', smartDebtRoutes);
//custommer service routes
app.use('/api/cs/auth', cs_authRoutes);
app.use('/api/cs/categories', cs_categoryRoutes);
app.use('/api/cs/products', cs_productRoutes);
app.use('/api/cs/inventory', cs_inventoryRoutes);
app.use('/api/cs/customers', cs_customerRoutes);
app.use('/api/cs/warehouses', cs_warehouseRoutes);
app.use('/api/cs/sale-order', cs_salesOrderRoutes);
app.use('/api/cs/products', cs_product_Routes);

// News routes
app.use('/api/news', newsRoutes);
app.use('/api/news-categories', newsCategoryRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  // Initialize database connection
  await connectDatabase();

  // Initialize Redis connection
  await initializeRedis();

  // Initialize upload directories
  await initializeUploads();

  // Initialize notification scheduler
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') {
    notificationScheduler.init();
  } else {
    console.log('⚠️  Notification scheduler disabled (set ENABLE_SCHEDULER=true to enable)');
  }

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Sales & Production Management API                   ║
║                                                           ║
║   📡 Server running on: http://localhost:${PORT}          ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}                      ║
║   📚 API Docs: http://localhost:${PORT}/api-docs         ║
║   🔐 Auth API: http://localhost:${PORT}/api/auth         ║
║   👥 User API: http://localhost:${PORT}/api/users        ║
║   🔑 Role API: http://localhost:${PORT}/api/roles        ║
║   ⚙️  Permission API: http://localhost:${PORT}/api/permissions ║
║   🏢 Warehouse API: http://localhost:${PORT}/api/warehouses ║
║   📂 Category API: http://localhost:${PORT}/api/categories ║
║   🏭 Supplier API: http://localhost:${PORT}/api/suppliers ║
║   🛒 Purchase Orders API: http://localhost:${PORT}/api/purchase-orders ║
║   📦 Product API: http://localhost:${PORT}/api/products   ║
║   📊 Inventory API: http://localhost:${PORT}/api/inventory ║
║   🔄 Stock Transaction API: http://localhost:${PORT}/api/stock-transactions ║
║   🚚 Stock Transfer API: http://localhost:${PORT}/api/stock-transfers ║
║   📋 BOM API: http://localhost:${PORT}/api/bom           ║
║   🏭 Production Orders API: http://localhost:${PORT}/api/production-orders ║
║   👤 Customer API: http://localhost:${PORT}/api/customers ║
║   🛒 Sales Orders API: http://localhost:${PORT}/api/sales-orders ║
║   🚚 Deliveries API: http://localhost:${PORT}/api/deliveries ║
║   💰 Payment Receipts API: http://localhost:${PORT}/api/payment-receipts ║
║   💸 Payment Vouchers API: http://localhost:${PORT}/api/payment-vouchers ║
║   📊 Debt Reconciliation API: http://localhost:${PORT}/api/debt-reconciliation ║
║   💰 Cash Fund API: http://localhost:${PORT}/api/cash-fund  ║
║   🎁 Promotions API: http://localhost:${PORT}/api/promotions ║
║   ⏰ Attendance API: http://localhost:${PORT}/api/attendance ║
║   💵 Salary API: http://localhost:${PORT}/api/salary        ║
║   🔔 Notifications API: http://localhost:${PORT}/api/notifications ║
║   📈 Reports API: http://localhost:${PORT}/api/reports      ║
║   ⚡ Performance API: http://localhost:${PORT}/api/performance ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
