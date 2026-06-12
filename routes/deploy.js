const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const NETLIFY_API_TOKEN = 'nfp_fqeds3UoHYixAgZLg7Teo5Xu39drLd5ad68b';

// Publish project endpoint
router.post('/publish', async (req, res) => {
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

        // Deploy to Netlify if token is available
        if (NETLIFY_API_TOKEN) {
            try {
                // Create a new Netlify site
                const siteResponse = await axios.post(
                    'https://api.netlify.com/api/v1/sites',
                    {
                        name: `${customSlug}-${Date.now()}`.toLowerCase()
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${NETLIFY_API_TOKEN}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const siteId = siteResponse.data.id;
                const netlifyUrl = siteResponse.data.url;

                // Create zip file content (Netlify expects a zip file)
                const FormData = require('form-data');
                const form = new FormData();
                
                // Add index.html to the form
                form.append('index.html', Buffer.from(mergedHtml), {
                    filename: 'index.html',
                    contentType: 'text/html'
                });

                // Deploy to Netlify
                const deployResponse = await axios.post(
                    `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
                    form,
                    {
                        headers: {
                            'Authorization': `Bearer ${NETLIFY_API_TOKEN}`,
                            ...form.getHeaders()
                        }
                    }
                );

                const message = projectId ? 'Project re-published to Netlify successfully!' : 'Project published to Netlify successfully!';
                
                return res.json({ 
                    success: true, 
                    url: `https://${deployResponse.data.ssl_url || netlifyUrl}`,
                    projectId: customSlug.toLowerCase(),
                    message,
                    netlifyInfo: {
                        siteId: siteId,
                        deploymentId: deployResponse.data.id,
                        deployUrl: deployResponse.data.deploy_ssl_url
                    }
                });

            } catch (netlifyError) {
                console.error('Netlify deployment error:', netlifyError.response?.data || netlifyError.message);
                // Fall back to local deployment if Netlify fails
                return deployLocally(mergedHtml, customSlug, projectId, res);
            }
        } else {
            // No Netlify token, deploy locally
            return deployLocally(mergedHtml, customSlug, projectId, res);
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function for local deployment
function deployLocally(mergedHtml, customSlug, projectId, res) {
    const projectPath = path.join(__dirname, '..', 'public', 'projects', customSlug.toLowerCase());

    // Check if project already exists (for new projects only, not republish)
    if (!projectId && fs.existsSync(projectPath)) {
        return res.status(400).json({ error: 'Project name already exists. Please choose a different name.' });
    }

    // Create directory
    fs.mkdirSync(projectPath, { recursive: true });

    // Save merged HTML file
    fs.writeFileSync(
        path.join(projectPath, 'index.html'),
        mergedHtml
    );

    const url = `${BASE_URL}/${customSlug.toLowerCase()}`;
    const message = projectId ? 'Project re-published locally successfully!' : 'Project published locally successfully!';
    
    return res.json({ 
        success: true, 
        url, 
        projectId: customSlug.toLowerCase(),
        message
    });
}

module.exports = router;
