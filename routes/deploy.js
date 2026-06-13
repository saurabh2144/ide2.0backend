const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const archiver = require('archiver');

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const NETLIFY_API_TOKEN = 'nfp_fqeds3UoHYixAgZLg7Teo5Xu39drLd5ad68b';

// Helper function to create ZIP buffer from HTML content
function createZipBuffer(htmlContent) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const archive = archiver.create('zip', {
            zlib: { level: 9 }
        });

        archive.on('data', (chunk) => chunks.push(chunk));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', (err) => reject(err));

        // Add index.html to the archive
        archive.append(htmlContent, { name: 'index.html' });
        archive.finalize();
    });
}

// Publish project endpoint
router.post('/publish', async (req, res) => {
    try {
        const { mergedHtml, projectName, customSlug, projectId, siteId } = req.body;

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
                // If siteId exists, update existing site (republish)
                if (siteId) {
                    console.log('Republishing to existing site:', siteId);
                    
                    // Create a ZIP file with the HTML content
                    const zipBuffer = await createZipBuffer(mergedHtml);

                    // Deploy to Netlify with ZIP
                    const deployResponse = await axios.post(
                        `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
                        zipBuffer,
                        {
                            headers: {
                                'Authorization': `Bearer ${NETLIFY_API_TOKEN}`,
                                'Content-Type': 'application/zip'
                            },
                            maxContentLength: Infinity,
                            maxBodyLength: Infinity
                        }
                    );

                    // Get site info
                    const siteInfo = await axios.get(
                        `https://api.netlify.com/api/v1/sites/${siteId}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${NETLIFY_API_TOKEN}`
                            }
                        }
                    );

                    const deployUrl = siteInfo.data.ssl_url || siteInfo.data.url || `https://${siteInfo.data.name}.netlify.app`;
                    
                    return res.json({ 
                        success: true, 
                        url: deployUrl,
                        projectId: customSlug.toLowerCase(),
                        siteId: siteId,
                        message: 'Site redeployed successfully!',
                        netlifyInfo: {
                            siteId: siteId,
                            siteName: siteInfo.data.name,
                            deploymentId: deployResponse.data.id
                        }
                    });
                    
                } else {
                    // Create new Netlify site (first publish)
                    console.log('Creating new Netlify site:', customSlug);
                    
                    const siteResponse = await axios.post(
                        'https://api.netlify.com/api/v1/sites',
                        {
                            name: customSlug.toLowerCase()
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${NETLIFY_API_TOKEN}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    const newSiteId = siteResponse.data.id;
                    const siteName = siteResponse.data.name;

                    // Create a ZIP file with the HTML content
                    const zipBuffer = await createZipBuffer(mergedHtml);

                    // Deploy to new site with ZIP
                    const deployResponse = await axios.post(
                        `https://api.netlify.com/api/v1/sites/${newSiteId}/deploys`,
                        zipBuffer,
                        {
                            headers: {
                                'Authorization': `Bearer ${NETLIFY_API_TOKEN}`,
                                'Content-Type': 'application/zip'
                            },
                            maxContentLength: Infinity,
                            maxBodyLength: Infinity
                        }
                    );

                    const deployUrl = siteResponse.data.ssl_url || siteResponse.data.url || `https://${siteName}.netlify.app`;
                    
                    return res.json({ 
                        success: true, 
                        url: deployUrl,
                        projectId: customSlug.toLowerCase(),
                        siteId: newSiteId,
                        message: 'Site published successfully!',
                        netlifyInfo: {
                            siteId: newSiteId,
                            siteName: siteName,
                            deploymentId: deployResponse.data.id
                        }
                    });
                }

            } catch (netlifyError) {
                console.error('Netlify deployment error:');
                console.error('Status:', netlifyError.response?.status);
                console.error('Data:', netlifyError.response?.data);
                console.error('Message:', netlifyError.message);
                
                // Don't fallback - return error to user
                return res.status(500).json({ 
                    success: false,
                    error: 'Netlify deployment failed: ' + (netlifyError.response?.data?.message || netlifyError.message),
                    details: netlifyError.response?.data
                });
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
    const message = projectId ? 'Site redeployed locally successfully!' : 'Site published locally successfully!';
    
    return res.json({ 
        success: true, 
        url, 
        projectId: customSlug.toLowerCase(),
        message
    });
}

// Get deployments endpoint (for compatibility)
router.get('/deployments', async (req, res) => {
    try {
        // Return empty array for now - can be extended later
        res.json({ 
            success: true, 
            deployments: [] 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
