require('dotenv').config();

const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
//for testing stock quantity
const DEMO_STOCK = 5;

const products = [
  // ======================
  // SUPPLEMENTS (4)
  // ======================
  {
    slug: 'whey-protein',
    name: 'Whey Protein',
    description: 'Premium 25g protein per serving. Low carb, fast-absorbing formula.',
    price: '54.99',
    imageUrl: 'https://www.bareperformancenutrition.com/cdn/shop/files/BPNWPC_VN-8_JR_RENDER_1024x1024.jpg?v=1753802657',
    category: 'SUPPLEMENTS',
  },
  {
    slug: 'creatine-monohydrate',
    name: 'Creatine Monohydrate',
    description: 'Pure micronized creatine for strength and power gains.',
    price: '29.99',
    imageUrl: 'https://www.bareperformancenutrition.com/cdn/shop/files/BPNCREA-5_1024x1024.jpg?v=1728563526',
    category: 'SUPPLEMENTS',
  },
  {
    slug: 'G.1.M-Sport-preworkout',
    name: 'G.1.M Sport preworkout',
    description: 'Carbohydrates and electrolytes to fuel, hydrate, and improve performance',
    price: '39.90',
    imageUrl: 'https://www.bareperformancenutrition.com/cdn/shop/files/G1M-OR-2_CL_Render_1024x1024.jpg?v=1756228410',
    category: 'SUPPLEMENTS',
  },
  {
    slug: 'omega-3-fish-oil',
    name: 'Omega-3 Fish Oil',
    description: 'Daily essential fats for recovery and overall wellness.',
    price: '24.90',
    imageUrl: 'https://www.kineticasports.com/cdn/shop/files/kinetica-sports-omega-3-shot-of-product-571183.png?v=1720424467',
    category: 'SUPPLEMENTS',
  },
  {
  slug: 'electrolyte-hydration-mix',
  name: 'Electrolyte Hydration Mix',
  description: 'Electrolytes for hydration support during training.',
  price: '19.90',
  imageUrl: 'https://www.stromsports.com/cdn/shop/files/Electrolyte_Blackcurrant.png?v=1699290443&width=1080',
  category: 'SUPPLEMENTS',
  },

  // ======================
  // WOMENS_CLOTHING (4)
  // ======================
  {
    slug: 'high-waist-leggings',
    name: 'High-Waist Leggings',
    description: 'Squat-proof compression leggings with phone pocket.',
    price: '48.99',
    imageUrl: 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcQ1UiXEj5184umXvAvp1rCEzVX1gVX12DN3HSr2VwfHGyRRVmstfvZ19wyTgVMSxcmR_58qR3sdh1L_ZaeMo9YfqVakjW6J1Ejh0ZotFCL4u0anTLLgATThtg',
    category: 'WOMENS_CLOTHING',
  },
  {
    slug: 'seamless-sports-bra',
    name: 'Seamless Sports Bra',
    description: 'Light support bra with breathable stretch fabric.',
    price: '32.90',
    imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcQIm6-F9O2df3ed9j-IT3VAPPxTB9zuElDGyqU2rhpvMLQG0A2aM9j9gVbBjsTHN2LpbsQ_ihPgqy-3G1zsNuHhMo96sEB6',
    category: 'WOMENS_CLOTHING',
  },
  {
    slug: 'oversized-cropped-hoodie',
    name: 'Oversized Cropped Hoodie',
    description: 'Warm-up layer with relaxed fit and soft interior.',
    price: '54.00',
    imageUrl: 'https://www.supesu.com/cdn/shop/files/main-1_3e13ef53-4e37-40e2-b770-eb78c19fae61.jpg?v=1769496282',
    category: 'WOMENS_CLOTHING',
  },
  {
    slug: 'training-shorts-2-in-1',
    name: 'Training Shorts 2-in-1',
    description: 'Built-in liner shorts for comfort and confidence.',
    price: '36.00',
    imageUrl: 'https://www.myprotein.com.sg/images?url=https://static.thcdn.com/productimg/original/15612348-1535228685770184.jpg&format=webp&auto=avif&crop=1100,1200,smart',
    category: 'WOMENS_CLOTHING',
  },

  // ======================
  // MENS_CLOTHING (4)
  // ======================
  {
    slug: 'performance-tank-top',
    name: 'Performance Tank Top',
    description: 'Breathable mesh fabric with moisture-wicking technology.',
    price: '34.99',
    imageUrl: 'https://tailoredathlete.co.uk/cdn/shop/files/Training_Vest_Black__14_2000x.jpg?v=1763490823',
    category: 'MENS_CLOTHING',
  },
  {
    slug: 'oversized-training-tee',
    name: 'Oversized Training Tee',
    description: 'Boxy fit tee for workouts or daily wear.',
    price: '36.00',
    imageUrl: 'https://cdn.shopify.com/s/files/1/0683/6600/8542/files/f2_d5013474-b241-4835-a0f2-5f8ee7474539.jpg?v=1721395752&crop=center&height=1000&width=1000&format=webp',
    category: 'MENS_CLOTHING',
  },
  {
    slug: 'training-shorts-core',
    name: 'Training Shorts (Core)',
    description: 'Lightweight shorts with zip pockets and stretch waist.',
    price: '38.00',
    imageUrl: 'https://tailoredathlete.co.uk/cdn/shop/files/Training_Shorts_Black__10_5000x.jpg?v=1763485325',
    category: 'MENS_CLOTHING',
  },
  {
    slug: 'compression-long-sleeve',
    name: 'Compression Long Sleeve',
    description: 'Tight fit top for support and heat management.',
    price: '42.00',
    imageUrl: 'https://row.venum.com/cdn/shop/files/504f78361541228212bd803b116e94e3ac29f104_VENUM_05008_001___VNM___1.jpg?v=1749742680&width=1646',
    category: 'MENS_CLOTHING',
  },
];

async function main() {
  for (const p of products) {
    await prisma.storeProduct.upsert({
    where: { slug: p.slug },
    update: {
      name: p.name,
      description: p.description,
      price: new Prisma.Decimal(p.price),
      imageUrl: p.imageUrl,
      category: p.category,
      isActive: true,

      // inventory
      stockQty: DEMO_STOCK,
      reservedQty: 0,
      inventoryStatus: 'AVAILABLE',
    },
    create: {
      slug: p.slug,
      name: p.name,
      description: p.description,
      price: new Prisma.Decimal(p.price),
      imageUrl: p.imageUrl,
      category: p.category,
      isActive: true,

      // inventory
      stockQty: DEMO_STOCK,
      reservedQty: 0,
      inventoryStatus: 'AVAILABLE',
    },
  });
}

  console.log('successfully seeded StoreProduct');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

