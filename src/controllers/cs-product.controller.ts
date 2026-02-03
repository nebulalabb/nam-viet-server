import { Response, Request } from 'express';
import storeProductService from '@services/cs-product.service';
import { ApiResponse } from '@custom-types/common.type';

// Nếu bạn có interface AuthRequest thì import vào, nếu không dùng (req as any) cũng được
// import { AuthRequest } from '@custom-types/common.type';

class PublicProductController {
    async getAll(req: Request, res: Response) {
       const { 
          page, limit, search, categoryId, 
          sortBy,
          historySearch,
          packagingType
       } = req.query;

      console.log("Con cóc quý", req.query)
   

       const result = await storeProductService.getPublicProducts({
         page: page ? Number(page) : 1,
         limit: limit ? Number(limit) : 20,
         search: search as string,
         categoryId: categoryId ? Number(categoryId) : undefined,
         sortBy: sortBy as any,
         historySearch: historySearch as any,
         packagingType: packagingType as any,
       });

       const response: ApiResponse = {
         success: true,
         data: result.data, 
         meta: result.pagination,
         timestamp: new Date().toISOString(),
       };
   
       res.status(200).json(response);
     }
   
     // =================================================================
     // GET /api/store/products/:id (Chi tiết - Có đa giá & List khuyến mãi)
     // =================================================================
     async getById(req: Request, res: Response) {
       const { slug } = req.params;
      //  const currentUser = (req as any).user;
      //  const userType = currentUser?.classification || 'retail';

      //  // 2. Gọi hàm detail kèm userType
       const product = await storeProductService.getProductDetail(slug);
      
       const response: ApiResponse = {
         success: true,
         data: product,
         timestamp: new Date().toISOString(),
       };
   
       res.status(200).json(response);
     }

}

export default new PublicProductController();