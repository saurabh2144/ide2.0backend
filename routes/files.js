const express = require('express');
const router = express.Router();

// In-memory file storage
const userFiles = new Map(); // userId -> files array

// Save files endpoint
router.post('/save', (req, res) => {
    try {
        const { userId, files } = req.body;

        if (!userId || !files) {
            return res.status(400).json({ error: 'userId and files are required' });
        }

        // Save files for user
        userFiles.set(userId, files);

        res.json({
            success: true,
            message: 'Files saved successfully',
            filesCount: files.length
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get files endpoint
router.get('/:userId', (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Get files for user
        const files = userFiles.get(userId) || [];

        res.json({
            success: true,
            files
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
