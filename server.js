const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());

// Import routes
const aiRoutes = require('./routes/ai');
const authRoutes = require('./routes/auth');
const filesRoutes = require('./routes/files');
const deployRoutes = require('./routes/deploy');

// Use routes
app.use('/api', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);
app.use('/api', deployRoutes);

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

// Serve static projects
app.use('/projects', express.static(path.join(__dirname, 'public', 'projects')));

app.listen(PORT, () => {
    console.log(`Server running on ${BASE_URL}`);
});
