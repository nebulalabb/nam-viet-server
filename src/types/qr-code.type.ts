export interface QRCodePayload {
  sessionToken: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface GenerateQRInput {
  startDate: string;
  endDate: string;
}

export interface ScanQRInput {
  qrData: string;
  location?: string;
}

export interface QRCodeResponse {
  id: number;
  qrCode: string;
  sessionToken: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  usageCount: number;
  createdBy: number;
  createdAt: Date;
  expiresAt: Date;
  token: string; // JWT token for QR code
}
