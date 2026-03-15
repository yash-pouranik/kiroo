import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- Mock Data ---
const PRODUCTS = [
  { id: 'sky-1', name: 'Astralis Chronograph', category: 'Luxury Watches', owner: 'Astralis Horology', stock: 5 },
  { id: 'sky-2', name: 'Nebula Silk Scarf', category: 'Fashion', owner: 'Nebula Couture', stock: 12 },
  { id: 'sky-3', name: 'Quasar Sound Link', category: 'Audio', owner: 'Quasar Audio', stock: 0 }
];

const USER = { 
  id: 'u-1', 
  name: 'Yash', 
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Yash',
  bio: 'API Enthusiast & Developer',
  country: 'IN', 
  currency: 'INR' 
};

// --- API V1: Legacy State ---

// List Products (v1)
app.get('/api/v1/products', (req, res) => {
  const productsV1 = PRODUCTS.map(p => ({
    ...p,
    author: p.owner,
    price: p.id === 'sky-1' ? 4500 : (p.id === 'sky-2' ? 120 : 890) 
  }));
  res.json(productsV1);
});

// User Profile (v1) - Flat structure
app.get('/api/v1/user', (req, res) => {
  res.json({
    id: USER.id,
    name: USER.name,
    country: USER.country,
    currency: USER.currency
  });
});

// Reviews (v1) - Array of strings
app.get('/api/v1/products/:id/reviews', (req, res) => {
  res.json(['Great quality!', 'Highly recommended', 'Exquisite craftsmanship']);
});

// Wishlist (v1) - Array of IDs
app.get('/api/v1/wishlist', (req, res) => {
  res.json(['sky-1', 'sky-2']);
});

// Search (v1) - Flat array response
app.get('/api/v1/search', (req, res) => {
  const q = req.query.q || '';
  const results = PRODUCTS.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  res.json(results);
});

app.post('/api/v1/checkout', (req, res) => {
  const { productId } = req.body;
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.stock === 0) return res.status(400).json({ error: 'Product is region-restricted for your current location' });
  res.status(200).json({ 
    success: true, 
    message: 'Order placed successfully!',
    orderId: `ORD-${Math.floor(Math.random() * 100000)}`
  });
});


// --- API V2: Evolution (Breaking Changes) ---

// Products (v2) - Structural Change: Price is Object, 'author' -> 'owner'
app.get('/api/v2/products', (req, res) => {
  const productsV2 = PRODUCTS.map(p => ({
    ...p,
    price: {
      amount: p.id === 'sky-1' ? 4500 : (p.id === 'sky-2' ? 120 : 890),
      currency: 'USD',
      symbol: '$'
    }
  }));
  res.json(productsV2);
});

// User Profile (v2) - Nested structure (Breaking)
app.get('/api/v2/user', (req, res) => {
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
      }
    }
  });
});

// Reviews (v2) - Array of Objects (Breaking)
app.get('/api/v2/products/:id/reviews', (req, res) => {
  res.json([
    { user: 'Alice', rating: 5, comment: 'Great quality!' },
    { user: 'Bob', rating: 4, comment: 'Highly recommended' }
  ]);
});

// Wishlist (v2) - Full Objects (Breaking)
app.get('/api/v2/wishlist', (req, res) => {
  res.json(PRODUCTS.slice(0, 2).map(p => ({
    id: p.id,
    name: p.name,
    category: p.category
  })));
});

// Search (v2) - Object with metadata (Breaking)
app.get('/api/v2/search', (req, res) => {
  const q = req.query.q || '';
  const results = PRODUCTS.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  res.json({
    query: q,
    results: results,
    total: results.length,
    suggestion: q ? `Looking for ${q}?` : 'Try Astra...'
  });
});

// Status Change: 202 Accepted instead of 200 OK
app.post('/api/v2/checkout', (req, res) => {
  const { productId } = req.body;
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Item missing from catalog' });
  if (product.stock === 0) {
    return res.status(403).json({ 
      error: 'Stock verification failed',
      details: 'This luxury item is currently region-locked due to shipping logistics in your area. Please contact support.' 
    });
  }
  res.status(202).json({ 
    status: 'Accepted', 
    message: 'Order is being processed by our warehouse.',
    trackingUrl: `/api/v2/orders/track/${Math.floor(Math.random() * 1000)}`
  });
});

// v2 Only: Notifications
app.get('/api/v2/notifications', (req, res) => {
  res.json([
    { id: 1, type: 'info', message: 'Welcome to SkyStore V2!' },
    { id: 2, type: 'promo', message: 'Use code LUXURY50 for 50% off!' }
  ]);
});

app.listen(PORT, () => {
  console.log(`\n  ✨ SkyStore API: Expanded Surface`);
  console.log(`  ----------------------------------`);
  console.log(`  V1 Endpoints: /api/v1/[products|user|wishlist|search]`);
  console.log(`  V2 Endpoints: /api/v2/[products|user|wishlist|search|notifications]`);
  console.log(`  ----------------------------------\n`);
});
