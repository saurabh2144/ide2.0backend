const express = require('express');
const router = express.Router();
const AIAgent = require('../services/ai/AIAgent');
const { optionalAuth } = require('../middleware/auth');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs').promises;

// Chat endpoint (conversational mode) - backwards compatible
router.post('/chat', optionalAuth, async (req, res) => {
    try {
        const { message, conversationHistory = [], llmConfig } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await AIAgent.chat(message, conversationHistory, llmConfig);

        res.json({
            success: true,
            reply: result.reply,
            usage: result.usage
        });

    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.response?.data 
        });
    }
});

// Generate/modify code - backwards compatible
router.post('/generate-code', optionalAuth, async (req, res) => {
    try {
        const { code, prompt, llmConfig } = req.body;

        if (!prompt || !prompt.trim()) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const result = await AIAgent.generateCode(code || '', prompt, llmConfig);

        res.json({
            success: true,
            generatedCode: result.generatedCode,
            usage: result.usage
        });

    } catch (error) {
        console.error('Code Generation Error:', error);
        res.status(500).json({ 
            error: error.message 
        });
    }
});

// AI Agent - Execute task on project
router.post('/agent/execute', optionalAuth, async (req, res) => {
    try {
        console.log('API call: /agent/execute');
        console.log('req body:', Object.keys(req.body));
        
        const { projectId, task, files, llmConfig } = req.body;

        if (!task) {
            console.log('missing task');
            return res.status(400).json({ 
                error: 'task is required' 
            });
        }

        // Mode 1: With projectId (requires auth)
        if (projectId) {
            console.log('mode: project');
            console.log('projectId:', projectId);
            
            if (!req.userId) {
                console.log('auth failed');
                return res.status(401).json({ 
                    error: 'Authentication required for project operations' 
                });
            }

            console.log('userId:', req.userId);
            const result = await AIAgent.executeTask(
                projectId,
                req.userId,
                task,
                llmConfig
            );

            console.log('done: sent project response');
            return res.json({
                success: true,
                ...result
            });
        }

        // Mode 2: Without projectId - work with files
        if (files && Array.isArray(files)) {
            console.log('mode: files');
            console.log('files count:', files.length);
            
            const result = await AIAgent.executeTaskOnFiles(files, task, llmConfig);
            
            console.log('done: sent response');
            console.log('result:', result.success);
            
            return res.json({
                success: true,
                ...result
            });
        }

        console.log('invalid request parameters');
        return res.status(400).json({ 
            error: 'Either projectId or files array is required' 
        });

    } catch (error) {
        console.error('API Error:', error.message);
        res.status(500).json({ 
            error: error.message 
        });
    }
});

// AI Agent - Analyze project
router.post('/agent/analyze', optionalAuth, async (req, res) => {
    try {
        const { projectId } = req.body;

        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        if (!req.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const ContextManager = require('../services/ai/ContextManager');
        const context = await ContextManager.buildProjectContext(projectId, req.userId);

        res.json({
            success: true,
            context: {
                projectName: context.projectName,
                projectType: context.projectType,
                structure: context.structure,
                fileCount: context.fileCount
            }
        });

    } catch (error) {
        console.error('Project Analysis Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;



// Download project as ZIP
router.post('/download-zip', async (req, res) => {
    try {
        console.log('creating zip file...');
        const { files } = req.body;

        if (!files || !Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ error: 'No files provided' });
        }

        const zip = new AdmZip();

        // Add each file to zip
        files.forEach(file => {
            console.log(`  Adding: ${file.filename}`);
            zip.addFile(file.filename, Buffer.from(file.content || '', 'utf8'));
        });

        // Generate zip buffer
        const zipBuffer = zip.toBuffer();

        console.log(`zip created: ${zipBuffer.length} bytes`);

        // Send zip file
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=project.zip');
        res.send(zipBuffer);

    } catch (error) {
        console.error('zip creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upload project folder
router.post('/upload-folder', async (req, res) => {
    try {
        console.log('processing upload...');
        const { files } = req.body;

        if (!files || !Array.isArray(files)) {
            return res.status(400).json({ error: 'Invalid files format' });
        }

        console.log(`received ${files.length} files`);
        
        // Return normalized files
        const normalizedFiles = files.map((file, index) => ({
            id: Date.now() + index,
            filename: file.filename,
            content: file.content || ''
        }));

        res.json({
            success: true,
            files: normalizedFiles,
            count: normalizedFiles.length
        });

    } catch (error) {
        console.error('upload error:', error);
        res.status(500).json({ error: error.message });
    }
});


// Terminal command execution
router.post('/execute-command', async (req, res) => {
    try {
        console.log('terminal request received');
        const { command, cwd, projectId, files } = req.body;

        if (!command || !command.trim()) {
            return res.status(400).json({ error: 'Command is required' });
        }

        console.log(`command: ${command}`);

        const { exec } = require('child_process');
        
        // Determine working directory
        let workingDir = process.cwd();
        
        // If files provided, save them to temp directory
        if (files && Array.isArray(files) && files.length > 0) {
            const tempId = projectId || `temp-${Date.now()}`;
            workingDir = path.join(process.cwd(), 'temp-projects', tempId);
            
            // Create directory if not exists
            await fs.mkdir(workingDir, { recursive: true });
            
            console.log(`saving ${files.length} files to: ${workingDir}`);
            
            // Save all files
            for (const file of files) {
                const filePath = path.join(workingDir, file.filename);
                const fileDir = path.dirname(filePath);
                
                // Create subdirectories if needed
                await fs.mkdir(fileDir, { recursive: true });
                
                // Write file
                await fs.writeFile(filePath, file.content || '', 'utf8');
            }
            
            console.log(`files saved`);
        } else if (projectId) {
            // Use existing project-specific directory
            workingDir = path.join(process.cwd(), 'temp-projects', projectId);
        } else if (cwd) {
            workingDir = cwd;
        }

        console.log(`working dir: ${workingDir}`);

        // Execute command
        exec(command, { 
            cwd: workingDir,
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            timeout: 300000 // 5 minutes timeout
        }, (error, stdout, stderr) => {
            
            console.log('command execution done');
            
            if (error && error.killed) {
                console.log('command timed out');
                return res.json({
                    success: false,
                    output: '',
                    error: 'Command timeout or killed',
                    exitCode: error.code || 1
                });
            }

            const output = stdout || '';
            const errorOutput = stderr || '';
            const hasError = error && error.code !== 0;

            console.log(`output length: ${output.length}`);
            console.log(`error length: ${errorOutput.length}`);
            console.log(`exit code: ${error?.code || 0}`);

            res.json({
                success: !hasError,
                output: output,
                error: errorOutput,
                exitCode: error?.code || 0
            });
        });

    } catch (error) {
        console.error('terminal error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message,
            exitCode: 1
        });
    }
});
