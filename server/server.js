const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Load gin data and tonic links
const ginsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/gins.json'), 'utf-8')
);

const tonicLinks = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/tonic-links.json'), 'utf-8')
);

// Helper function to add Amazon links
const addAmazonLink = (gin) => ({
  ...gin,
  amazonLink: tonicLinks[gin.tonic] || `https://www.amazon.com/s?k=${encodeURIComponent(gin.tonic)}`
});

// API Routes
app.get('/api/gins', (req, res) => {
  const { search } = req.query;

  if (!search) {
    return res.json(ginsData.map(addAmazonLink));
  }

  const filtered = ginsData.filter(gin =>
    gin.name.toLowerCase().includes(search.toLowerCase()) ||
    gin.profile.toLowerCase().includes(search.toLowerCase())
  );

  res.json(filtered.map(addAmazonLink));
});

app.get('/api/gins/:name', (req, res) => {
  const ginName = decodeURIComponent(req.params.name);
  const gin = ginsData.find(g => g.name.toLowerCase() === ginName.toLowerCase());

  if (!gin) {
    return res.status(404).json({ error: 'Gin not found' });
  }

  res.json(addAmazonLink(gin));
});

app.get('/api/categories', (req, res) => {
  res.json(['Citrus', 'Floral', 'Spicy', 'Dry']);
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🍸 TonicWater.io server running on http://localhost:${PORT}`);
});
