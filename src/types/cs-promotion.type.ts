export interface PromotionInfo {
  id: number;
  name: string;
  type: string;
  value?: number;
  giftName?: string;
  endDate: Date;
}