import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const PRODUCTS = [
  { id: 'sky-1', name: 'Astralis Chronograph', category: 'Luxury Watches', owner: 'Astralis Horology', stock: 5 },
  { id: 'sky-2', name: 'Nebula Silk Scarf', category: 'Fashion', owner: 'Nebula Couture', stock: 12 },
  { id: 'sky-3', name: 'Quasar Sound Link', category: 'Audio', owner: 'Quasar Audio', stock: 0 },
  { id: 'sky-4', name: 'Orbit Desk Lamp', category: 'Home Decor', owner: 'Orbit Living', stock: 8 }
];

const USER = {
  id: 'u-1',
  name: 'Yash',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Yash',
  bio: 'API Enthusiast & Developer',
  country: 'IN',
  currency: 'INR'
};

const ORDER_BASE = {
  id: 'ord-2049',
  productId: 'sky-1',
  status: 'processing',
  paymentMethod: 'card',
  channel: 'web'
};

// ---------------------------
// API V1: Legacy contract
// ---------------------------

app.get('/api/v1/products', (_req, res) => {
  const productsV1 = PRODUCTS.map((p) => ({
    ...p,
    author: p.owner,
    price: p.id === 'sky-1' ? 4500 : (p.id === 'sky-2' ? 120 : (p.id === 'sky-3' ? 890 : 249))
  }));
  res.json(productsV1);
});

app.get('/api/v1/user', (_req, res) => {
  res.json({
    id: USER.id,
    name: USER.name,
    country: USER.country,
    currency: USER.currency
  });
});

app.get('/api/v1/products/:id/reviews', (_req, res) => {
  res.json(['Great quality!', 'Highly recommended', 'Exquisite craftsmanship']);
});

app.get('/api/v1/wishlist', (_req, res) => {
  res.json(['sky-1', 'sky-2']);
});

app.get('/api/v1/search', (req, res) => {
  const q = req.query.q || '';
  const results = PRODUCTS.filter((p) => p.name.toLowerCase().includes(String(q).toLowerCase()));
  res.json(results);
});

app.post('/api/v1/checkout', (req, res) => {
  const { productId } = req.body;
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.stock === 0) return res.status(400).json({ error: 'Product is region-restricted for your current location' });
  return res.status(200).json({
    success: true,
    message: 'Order placed successfully!',
    orderId: `ORD-${Math.floor(Math.random() * 100000)}`
  });
});

app.get('/api/v1/orders/:id', (req, res) => {
  res.json({
    id: req.params.id,
    status: ORDER_BASE.status,
    channel: ORDER_BASE.channel,
    etaDays: 4
  });
});

app.get('/api/v1/inventory/:id', (req, res) => {
  const product = PRODUCTS.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Inventory item not found' });
  return res.json({
    productId: product.id,
    stock: product.stock,
    warehouse: 'blr-central'
  });
});

app.get('/api/v1/shipping/quote', (req, res) => {
  const country = String(req.query.country || 'IN').toUpperCase();
  res.json({
    country,
    etaDays: country === 'IN' ? 2 : 6,
    cost: country === 'IN' ? 80 : 240,
    currency: 'INR'
  });
});

app.get('/api/v1/coupons/validate', (req, res) => {
  const code = String(req.query.code || '').toUpperCase();
  const valid = code === 'LUX10';
  return res.json({
    valid,
    discountPercent: valid ? 10 : 0,
    reason: valid ? null : 'Coupon not found'
  });
});

// ---------------------------
// API V2: Evolved contract
// ---------------------------

app.get('/api/v2/products', (_req, res) => {
  const productsV2 = PRODUCTS.map((p) => ({
    ...p,
    price: {
      amount: p.id === 'sky-1' ? 4500 : (p.id === 'sky-2' ? 120 : (p.id === 'sky-3' ? 890 : 249)),
      currency: 'USD',
      symbol: '$'
    },
    inventory: {
      inStock: p.stock > 0,
      warehouses: p.stock > 0 ? ['blr-central', 'delhi-east'] : []
    }
  }));
  res.json(productsV2);
});

app.get('/api/v2/user', (_req, res) => {
  res.json({
    profile: {
      id: USER.id,
      name: USER.name,
      avatar: USER.avatar,
      bio: USER.bio
    },
    preferences: {
      location: USER.country,
      currency: {
        code: USER.currency,
        symbol: '₹'
      },
      locale: 'en-IN'
    }
  });
});

app.get('/api/v2/products/:id/reviews', (_req, res) => {
  res.json([
    { user: 'Alice', rating: 5, comment: 'Great quality!' },
    { user: 'Bob', rating: 4, comment: 'Highly recommended' }
  ]);
});

app.get('/api/v2/wishlist', (_req, res) => {
  res.json(PRODUCTS.slice(0, 2).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category
  })));
});

app.get('/api/v2/search', (req, res) => {
  const q = req.query.q || '';
  const results = PRODUCTS.filter((p) => p.name.toLowerCase().includes(String(q).toLowerCase()));
  res.json({
    query: q,
    results,
    total: results.length,
    suggestion: q ? `Looking for ${q}?` : 'Try Astra...'
  });
});

app.post('/api/v2/checkout', (req, res) => {
  const { productId } = req.body;
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Item missing from catalog' });
  if (product.stock === 0) {
    return res.status(403).json({
      error: 'Stock verification failed',
      details: 'This luxury item is currently region-locked due to shipping logistics in your area. Please contact support.'
    });
  }
  return res.status(202).json({
    status: 'accepted',
    message: 'Order is being processed by our warehouse.',
    trackingUrl: `/api/v2/orders/track/${Math.floor(Math.random() * 1000)}`
  });
});

app.get('/api/v2/orders/:id', (req, res) => {
  res.json({
    order: {
      id: req.params.id,
      state: {
        code: 'picked',
        label: 'Picked from warehouse'
      },
      channel: {
        source: 'web',
        campaign: 'spring-drop'
      },
      eta: {
        minDays: 1,
        maxDays: 3
      }
    }
  });
});

app.get('/api/v2/inventory/:id', (req, res) => {
  const product = PRODUCTS.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Inventory item not found' });
  return res.json({
    productId: product.id,
    stock: {
      total: product.stock,
      reserved: Math.max(0, Math.floor(product.stock / 2)),
      available: Math.ceil(product.stock / 2)
    },
    warehouses: [
      { code: 'blr-central', available: product.stock },
      { code: 'delhi-east', available: Math.max(0, product.stock - 2) }
    ]
  });
});

app.get('/api/v2/shipping/quote', (req, res) => {
  const country = String(req.query.country || 'IN').toUpperCase();
  const fast = String(req.query.fast || 'false') === 'true';

  if (country === 'BR') {
    return res.status(429).json({
      error: 'rate_limited',
      message: 'Shipping quote requests exceeded for this region'
    });
  }

  return res.json({
    destination: { country },
    pricing: {
      base: country === 'IN' ? 80 : 260,
      surcharge: fast ? 120 : 0,
      currency: 'USD'
    },
    eta: {
      minDays: fast ? 1 : 3,
      maxDays: fast ? 2 : 7
    }
  });
});

app.get('/api/v2/coupons/validate', (req, res) => {
  const code = String(req.query.code || '').toUpperCase();
  const valid = code === 'LUX10' || code === 'LUX20';
  return res.json({
    valid,
    discount: valid
      ? { type: 'percentage', value: code === 'LUX20' ? 20 : 10 }
      : null,
    constraints: valid
      ? { minOrderValue: 500, oneTime: true, status: 'active' }
      : { status: 'invalid', reason: 'Coupon not found' }
  });
});

app.get('/api/v2/notifications', (_req, res) => {
  res.json([
    { id: 1, type: 'info', message: 'Welcome to SkyStore V2!' },
    { id: 2, type: 'promo', message: 'Use code LUXURY50 for 50% off!' }
  ]);
});

app.listen(PORT, () => {
  console.log(`\n  ✨ SkyStore API: Expanded Surface`);
  console.log('  ----------------------------------');
  console.log('  V1: /api/v1/[products|user|wishlist|search|orders/:id|inventory/:id|shipping/quote|coupons/validate]');
  console.log('  V2: /api/v2/[products|user|wishlist|search|orders/:id|inventory/:id|shipping/quote|coupons/validate|notifications]');
  console.log('  ----------------------------------\n');
});
