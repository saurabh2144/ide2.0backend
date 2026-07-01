const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const WorkspaceManager = require('../services/workspace/WorkspaceManager');
const multer = require('multer');
const path = require('path');
const archiver = require('archiver');
const fs = require('fs').promises;

// File upload configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

// Get all user projects
router.get('/projects', auth, async (req, res) => {
    try {
        const projects = await WorkspaceManager.getUserProjects(req.userId);
        res.json({ success: true, projects });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new project
router.post('/projects', auth, async (req, res) => {
    try {
        const { name, description, type ,template } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        const project = await WorkspaceManager.createProject(req.userId, {
            name,
            description,
            type,
            template
        });

        res.json({
            success: true,
            message: 'Project created successfully',
            project
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Import project from ZIP
router.post('/projects/import-zip', auth, upload.single('zipFile'), async (req, res) => {
    try {
        const { name, description } = req.body;
        const zipFile = req.file;

        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }
        if (!zipFile) {
            return res.status(400).json({ error: 'ZIP file is required' });
        }

        const mongoose = require('mongoose');
        const Project = require('../models/Project');
        const User = require('../models/User');
        const projectId = new mongoose.Types.ObjectId();

        // 1. Create project directories
        const FileSystemManager = require('../services/filesystem/FileSystemManager');
        const userPath = path.join(FileSystemManager.workspacesDir, req.userId.toString());
        const projectPath = path.join(userPath, projectId.toString());
        await fs.mkdir(projectPath, { recursive: true });

        // 2. Extract ZIP content to project path
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(zipFile.buffer);
        zip.extractAllTo(projectPath, true);

        // 3. Register in Database
        const project = new Project({
            _id: projectId,
            name,
            description: description || '',
            owner: req.userId,
            type: 'web',
            fileSystemPath: projectPath,
            rootFiles: []
        });
        await project.save();

        // Add to user
        await User.findByIdAndUpdate(req.userId, {
            $push: { projects: projectId }
        });

        // 4. Update file count metadata
        await WorkspaceManager.updateProjectMetadata(projectId, req.userId);

        res.json({
            success: true,
            message: 'Project imported successfully from ZIP',
            project
        });

    } catch (error) {
        console.error('Import ZIP Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get project details with file tree
router.get('/projects/:projectId', auth, async (req, res) => {
    try {
        const project = await WorkspaceManager.getProject(
            req.params.projectId,
            req.userId
        );

        res.json({ success: true, project });
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// Delete project
router.delete('/projects/:projectId', auth, async (req, res) => {
    try {
        await WorkspaceManager.deleteProject(req.params.projectId, req.userId);
        res.json({ success: true, message: 'Project deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Read file
router.get('/projects/:projectId/files/*', auth, async (req, res) => {
    try {
        const filePath = req.params[0];
        
        if (!filePath) {
            return res.status(400).json({ error: 'File path is required' });
        }

        const file = await WorkspaceManager.readFile(
            req.params.projectId,
            req.userId,
            filePath
        );

        res.json({ success: true, file });
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// Write/Update file
router.put('/projects/:projectId/files/*', auth, async (req, res) => {
    try {
        const filePath = req.params[0];
        const { content } = req.body;

        if (!filePath) {
            return res.status(400).json({ error: 'File path is required' });
        }

        const result = await WorkspaceManager.writeFile(
            req.params.projectId,
            req.userId,
            filePath,
            content || ''
        );

        res.json({ success: true, file: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete file
router.delete('/projects/:projectId/files/*', auth, async (req, res) => {
    try {
        const filePath = req.params[0];

        if (!filePath) {
            return res.status(400).json({ error: 'File path is required' });
        }

        await WorkspaceManager.deleteFile(
            req.params.projectId,
            req.userId,
            filePath
        );

        res.json({ success: true, message: 'File deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create directory
router.post('/projects/:projectId/directories', auth, async (req, res) => {
    try {
        const { path: dirPath } = req.body;

        if (!dirPath) {
            return res.status(400).json({ error: 'Directory path is required' });
        }

        const result = await WorkspaceManager.createDirectory(
            req.params.projectId,
            req.userId,
            dirPath
        );

        res.json({ success: true, directory: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rename/Move file or directory
router.post('/projects/:projectId/files/rename', auth, async (req, res) => {
    try {
        const { oldPath, newPath } = req.body;

        if (!oldPath || !newPath) {
            return res.status(400).json({ error: 'Both oldPath and newPath are required' });
        }

        const result = await WorkspaceManager.rename(
            req.params.projectId,
            req.userId,
            oldPath,
            newPath
        );

        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload multiple files (for project import)
router.post('/projects/:projectId/upload', auth, upload.array('files'), async (req, res) => {
    try {
        const files = req.files;
        
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files provided' });
        }

        const results = [];

        for (const file of files) {
            // Extract relative path from fieldname or originalname
            const filePath = file.originalname;
            const content = file.buffer.toString('utf-8');

            const result = await WorkspaceManager.writeFile(
                req.params.projectId,
                req.userId,
                filePath,
                content
            );

            results.push(result);
        }

        res.json({
            success: true,
            message: `${results.length} files uploaded`,
            files: results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export project as ZIP
router.get('/projects/:projectId/export', auth, async (req, res) => {
    try {
        const project = await WorkspaceManager.getProject(
            req.params.projectId,
            req.userId
        );

        const archive = archiver('zip', { zlib: { level: 9 } });

        res.attachment(`${project.name}.zip`);
        archive.pipe(res);

        // Add all files from project directory
        const projectPath = project.fileSystemPath;
        archive.directory(projectPath, false);

        await archive.finalize();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update project metadata (file count, size, etc.)
router.patch('/projects/:projectId/metadata', auth, async (req, res) => {
    try {
        const project = await WorkspaceManager.updateProjectMetadata(
            req.params.projectId,
            req.userId
        );

        res.json({ success: true, metadata: project.metadata });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
