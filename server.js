const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize Express
const app = express();
const PORT = 5000;
const BASE_URL = 'http://localhost:5000';

// Database connection
const { connectDatabase } = require('./config/database');
connectDatabase();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://ide2-0frontend.vercel.app/'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Import routes
const aiRoutes = require('./routes/ai');
const authRoutes = require('./routes/auth');
const filesRoutes = require('./routes/files');
const deployRoutes = require('./routes/deploy');
const workspaceRoutes = require('./routes/workspace');

// Error handlers
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Health check endpoint for hosting platforms
app.get('/healthcheck', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '2.0.0',
        features: {
            workspace: true,
            aiAgent: true,
            authentication: true,
            mongodb: true
        }
    });
});

// API routes
app.use('/api', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes); // Legacy support
app.use('/api', deployRoutes);
app.use('/api/workspace', workspaceRoutes); // New workspace API

// Dynamic route to serve project without .html extension - ROOT LEVEL
app.get('/:slug', (req, res) => {
    const slug = req.params.slug;

    // Skip if it's an API route or static file
    if (slug === 'api' || slug === 'projects' || slug.includes('.')) {
        return res.status(404).send('Not Found');
    }

    const filePath = path.join(__dirname, 'public', 'projects', slug, 'index.html');

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('<h1>Project Not Found</h1><p>The requested project does not exist.</p>');
    }
});

// Serve static projects with proper content-type
app.use('/projects', express.static(path.join(__dirname, 'public', 'projects'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
    }
}));

// Also handle /projects/:slug route for cleaner URLs
app.get('/projects/:slug', (req, res) => {
    const slug = req.params.slug;
    const filePath = path.join(__dirname, 'public', 'projects', slug, 'index.html');

    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.sendFile(filePath);
    } else {
        res.status(404).send('<h1>Project Not Found</h1><p>The requested project does not exist.</p>');
    }
});

// Error handling - must be last
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
    // Create temp-projects directory for terminal execution
    const tempDir = path.join(__dirname, 'temp-projects');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log('Temp projects directory initialized');
    }

    console.log(`
=====================================
🚀 Web IDE Server v2.0.0
=====================================
Server: ${BASE_URL}
Database: MongoDB
Features: Workspace, AI Agent, Auth
=====================================
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    process.exit(0);
});


