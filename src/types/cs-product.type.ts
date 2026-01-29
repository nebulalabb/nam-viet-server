import { PromotionInfo } from "./cs-promotion.type";

export interface PublicProductDto {
  id: number;
  name: string;
  sku: string;
  slug: string;
  image?: string;
  video?: string;
  videoType?: string;
  unit: string;
  originalPrice: number;
  salePrice: number;
  discountPercentage: number;
  // isFeatured: boolean;
  inStock: boolean;
  category: { id: number; name: string; slug: string };
  promotion?: PromotionInfo | null;
}

export interface PublicProductDetailDto extends PublicProductDto {
  description?: string;
  barcode?: string;
  weight?: number;
  dimensions?: string;
  packagingType?: string;
  images: Array<{ url: string; alt?: string; isPrimary: boolean }>;
  videos: Array<{ url: string; thumbnail?: string; title?: string }>;
  availablePromotions: PromotionInfo[];
  relatedProducts?: PublicProductDto[];
}