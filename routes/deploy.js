const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const archiver = require('archiver');
const FormData = require('form-data');
const crypto = require('crypto');

// Force production URL on Render
const BASE_URL = process.env.RENDER ? 'https://myidebackend.onrender.com' : (process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`);
const NETLIFY_API_TOKEN = process.env.NETLIFY_API_TOKEN || 'nfp_fqeds3UoHYixAgZLg7Teo5Xu39drLd5ad68b';

// Helper function to deploy using Netlify's file-based API
async function deployToNetlifyWithFiles(siteId, htmlContent, token) {
    try {
        // Ensure proper HTML
        const htmlString = String(htmlContent);
        const htmlBuffer = Buffer.from(htmlString, 'utf-8');
        const sha1 = crypto.createHash('sha1').update(htmlBuffer).digest('hex');
        
        // Step 1: Create a deploy with file metadata
        const deployData = {
            files: {
                '/index.html': sha1
            }
        };
        
        const createDeployResponse = await axios.post(
            `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
            deployData,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const deployId = createDeployResponse.data.id;
        const requiredFiles = createDeployResponse.data.required || [];
        
        // Step 2: Upload the file if required
        if (requiredFiles.includes(sha1)) {
            await axios.put(
                `https://api.netlify.com/api/v1/deploys/${deployId}/files/index.html`,
                htmlBuffer,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/octet-stream'
                    }
                }
            );
        }
        
        return createDeployResponse.data;
    } catch (error) {
        console.error('Netlify file-based deployment error:', error.response?.data || error.message);
        throw error;
    }
}

// Publish project endpoint
router.post('/publish', async (req, res) => {
    try {
        const { mergedHtml, projectName, customSlug, projectId, siteId, deploymentType } = req.body;

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

        // If deployment type is 'backend', use local deployment
        if (deploymentType === 'backend') {
            return deployLocally(mergedHtml, customSlug, projectId, res);
        }

        // Deploy to Netlify if token is available
        if (NETLIFY_API_TOKEN) {
            try {
                // If siteId exists, update existing site (republish)
                if (siteId) {
                    console.log('Republishing to existing site:', siteId);
                    
                    // Use file-based deployment API
                    const deployResponse = await deployToNetlifyWithFiles(siteId, mergedHtml, NETLIFY_API_TOKEN);

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
                        deploymentType: 'netlify',
                        message: 'Site redeployed successfully on Netlify!',
                        netlifyInfo: {
                            siteId: siteId,
                            siteName: siteInfo.data.name,
                            deploymentId: deployResponse.id
                        }
                    });
                    
                } else {
                    // Create new Netlify site (first publish)
                    console.log('Creating new Netlify site:', customSlug);
                    
                    // Check if site name is available
                    try {
                        const checkResponse = await axios.get(
                            `https://api.netlify.com/api/v1/sites`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${NETLIFY_API_TOKEN}`
                                }
                            }
                        );

                        const existingSites = checkResponse.data || [];
                        const nameExists = existingSites.some(site => 
                            site.name === customSlug.toLowerCase() || 
                            site.custom_domain === `${customSlug.toLowerCase()}.netlify.app`
                        );

                        if (nameExists) {
                            return res.status(400).json({ 
                                success: false,
                                error: 'This name is already taken on Netlify. Please choose a different name.',
                                nameTaken: true
                            });
                        }
                    } catch (checkError) {
                        console.log('Could not verify name availability:', checkError.message);
                    }
                    
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

                    // Use file-based deployment API for new site
                    const deployResponse = await deployToNetlifyWithFiles(newSiteId, mergedHtml, NETLIFY_API_TOKEN);

                    const deployUrl = siteResponse.data.ssl_url || siteResponse.data.url || `https://${siteName}.netlify.app`;
                    
                    return res.json({ 
                        success: true, 
                        url: deployUrl,
                        projectId: customSlug.toLowerCase(),
                        siteId: newSiteId,
                        deploymentType: 'netlify',
                        message: 'Site published successfully on Netlify!',
                        netlifyInfo: {
                            siteId: newSiteId,
                            siteName: siteName,
                            deploymentId: deployResponse.id
                        }
                    });
                }

            } catch (netlifyError) {
                console.error('Netlify deployment error:');
                console.error('Status:', netlifyError.response?.status);
                console.error('Data:', netlifyError.response?.data);
                console.error('Message:', netlifyError.message);
                
                // Check if it's a subdomain uniqueness error
                if (netlifyError.response?.data?.errors?.subdomain) {
                    return res.status(400).json({ 
                        success: false,
                        error: 'This name is already taken on Netlify. Please choose a different name.',
                        nameTaken: true
                    });
                }
                
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
        return res.status(400).json({ 
            success: false,
            error: 'This project name already exists. Please choose a different name.',
            nameTaken: true
        });
    }

    // Create directory
    fs.mkdirSync(projectPath, { recursive: true });

    // Save merged HTML file
    fs.writeFileSync(
        path.join(projectPath, 'index.html'),
        mergedHtml
    );

    const url = `${BASE_URL}/projects/${customSlug.toLowerCase()}`;
    const message = projectId ? 'Site redeployed successfully on backend server!' : 'Site published successfully on backend server!';
    
    return res.json({ 
        success: true, 
        url, 
        projectId: customSlug.toLowerCase(),
        deploymentType: 'backend',
        message
    });
}

// Get list of backend deployed sites
router.get('/backend-sites', async (req, res) => {
    try {
        const projectsPath = path.join(__dirname, '..', 'public', 'projects');
        
        // Check if projects directory exists
        if (!fs.existsSync(projectsPath)) {
            return res.json({ success: true, sites: [] });
        }

        // Read all directories in projects folder
        const sites = fs.readdirSync(projectsPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => {
                const sitePath = path.join(projectsPath, dirent.name);
                const indexPath = path.join(sitePath, 'index.html');
                
                let lastModified = null;
                if (fs.existsSync(indexPath)) {
                    const stats = fs.statSync(indexPath);
                    lastModified = stats.mtime;
                }
                
                return {
                    slug: dirent.name,
                    url: `${BASE_URL}/projects/${dirent.name}`,
                    lastModified: lastModified
                };
            });

        res.json({ 
            success: true, 
            sites: sites 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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
