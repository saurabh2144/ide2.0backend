const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

// Publish project endpoint
router.post('/publish', (req, res) => {
    try {
        const { mergedHtml, projectName, customSlug, projectId } = req.body;

        if (!mergedHtml) {
            return res.status(400).json({ error: 'mergedHtml is required' });
        }

        if (!customSlug) {
            return res.status(400).json({ error: 'customSlug is required' });
        }

        // Validate slug
        const slugRegex = /^[a-z0-9-_]+$/i;
        if (!slugRegex.test(customSlug)) {
            return res.status(400).json({ error: 'Invalid slug format. Use only letters, numbers, hyphens, and underscores.' });
        }

        // Use custom slug as folder name
        const projectPath = path.join(__dirname, '..', 'public', 'projects', customSlug.toLowerCase());

        // Check if project already exists (for new projects only, not republish)
        if (!projectId && fs.existsSync(projectPath)) {
            return res.status(400).json({ error: 'Project name already exists. Please choose a different name.' });
        }

        // Create directory (will not fail if exists for republish)
        fs.mkdirSync(projectPath, { recursive: true });

        // Save/Update merged HTML file
        fs.writeFileSync(
            path.join(projectPath, 'index.html'),
            mergedHtml
        );

        const url = `${BASE_URL}/${customSlug.toLowerCase()}`;
        const message = projectId ? 'Project re-published successfully!' : 'Project published successfully!';
        
        res.json({ 
            success: true, 
            url, 
            projectId: customSlug.toLowerCase(),
            message
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
