import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedProductMedia() {
  console.log('🌱 Seeding Product Images & Videos...');

  await prisma.productImage.deleteMany();
  await prisma.productVideo.deleteMany();

  const products = await prisma.product.findMany({
    select: { id: true, sku: true, productName: true },
  });

  for (const p of products) {
    await prisma.productImage.create({
      data: {
        productId: p.id,
        imageUrl: `/images/products/${p.sku}/main.jpg`,
        altText: p.productName,
        isPrimary: true,
        displayOrder: 0,
      },
    });

    await prisma.productImage.createMany({
      data: [
        {
          productId: p.id,
          imageUrl: `https://www.honolulumagazine.com/content/uploads/2022/11/a/k/bbq-chicken-secret-sauce-and-golden-fried-gregg-hoshida.jpg`,
          altText: `${p.productName} - Góc 1`,
          displayOrder: 1,
        },
        {
          productId: p.id,
          imageUrl: `/images/products/${p.sku}/gallery-2.jpg`,
          altText: `${p.productName} - Góc 2`,
          displayOrder: 2,
        },
      ],
    });

    await prisma.productVideo.create({
      data: {
        productId: p.id,
        videoUrl: `https://www.youtube.com/watch?v=OeYTiDxkLmI`,
        videoType: 'demo',
        title: `Demo ${p.productName}`,
        description: `Video hướng dẫn sử dụng ${p.productName}`,
        isPrimary: true,
        displayOrder: 0,
        duration: 60,
      },
    });
  }

  console.log(`✅ Đã seed media cho ${products.length} sản phẩm`);
}

seedProductMedia()
  .catch((e) => {
    console.error('❌ Lỗi khi seed ProductMedia:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
