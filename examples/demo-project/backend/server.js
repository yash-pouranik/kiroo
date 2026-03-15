import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Mock Data
let projects = [
  { id: 1, name: 'Kiroo CLI', owner: 'Yash', status: 'Active' },
  { id: 2, name: 'Lingo SDK', owner: 'Lingo.dev', status: 'Beta' }
];

let deployments = [
  { id: 'dep-101', project: 'Kiroo CLI', environment: 'production', status: { state: 'success', color: 'green' }, timestamp: new Date().toISOString() }
];

// --- API VERSION 1 (Legacy / Stable) ---

// List Projects (v1)
app.get('/api/v1/projects', (req, res) => {
  // v1 uses 'author' instead of 'owner' in the logic, but data has owner
  const legacyProjects = projects.map(p => ({
    id: p.id,
    name: p.name,
    author: p.owner, // Field name: author
    status: p.status
  }));
  res.json(legacyProjects);
});

// List Deployments (v1)
app.get('/api/v1/deployments', (req, res) => {
  res.json(deployments);
});

// Trigger Deployment (v1)
app.post('/api/v1/deployments', (req, res) => {
  const { projectName } = req.body;
  const newDep = {
    id: `dep-${Math.floor(Math.random() * 1000)}`,
    project: projectName || 'Unknown',
    environment: 'staging',
    status: { state: 'pending', color: 'yellow' },
    timestamp: new Date().toISOString()
  };
  deployments.push(newDep);
  res.status(201).json(newDep);
});


// --- API VERSION 2 (Modern / Breaking Changes) ---

// List Projects (v2) - BREAKING CHANGE: Rename author -> owner
app.get('/api/v2/projects', (req, res) => {
  res.json(projects); 
});

// List Deployments (v2) - BREAKING CHANGE: Flattened status object
app.get('/api/v2/deployments', (req, res) => {
  const flattened = deployments.map(d => ({
    ...d,
    status: d.status.state, // Changed from object to string
    status_color: d.status.color
  }));
  res.json(flattened);
});

// New Endpoint in v2
app.get('/api/v2/logs', (req, res) => {
  res.json([
    { timestamp: new Date().toISOString(), level: 'info', message: 'Deployment triggered successfully' },
    { timestamp: new Date().toISOString(), level: 'warn', message: 'Latency spike detected in region us-east-1' }
  ]);
});

app.listen(PORT, () => {
  console.log(`\n  🚀 Demo API running at http://localhost:${PORT}`);
  console.log(`  --------------------------------------------`);
  console.log(`  V1 Endpoints: /api/v1/projects, /api/v1/deployments`);
  console.log(`  V2 Endpoints: /api/v2/projects, /api/v2/deployments, /api/v2/logs`);
  console.log(`  --------------------------------------------\n`);
});
