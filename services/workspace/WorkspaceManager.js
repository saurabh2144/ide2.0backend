const FileSystemManager = require('../filesystem/FileSystemManager');
const Project = require('../../models/Project');
const User = require('../../models/User');

class WorkspaceManager {
    constructor() {
        this.fsManager = FileSystemManager;
    }

    // Create new project for user
    async createProject(userId, projectData) {
        console.log("Full projectData:", projectData);
         console.log("Template received:", projectData.template);
        const { name, description, type = 'html', template = 'default' } = projectData;

        console.log('creating project with template:', template);

        // Create filesystem
        const mongoose = require('mongoose');
        const projectId = new mongoose.Types.ObjectId();
        
        // Pass shouldInitialize based on template choice (initialize if not scratch/blank)
        const shouldInitialize = (template && template !== 'scratch' && template !== 'blank');
        const templateToUse = shouldInitialize ? template : 'html';
        const projectPath = await this.fsManager.createProject(userId, projectId, name, templateToUse, shouldInitialize);

        console.log('project path created:', projectPath);
        console.log('files initialized:', shouldInitialize);

        // Create database record WITHOUT rootFiles initially
        const project = new Project({
            _id: projectId,
            name,
            description,
            owner: userId,
            type,
            fileSystemPath: projectPath,
            rootFiles: [] // Empty array initially
        });

        // Save first without rootFiles data
        await project.save();

        // Add to user's projects
        await User.findByIdAndUpdate(userId, {
            $push: { projects: projectId }
        });

        // Return project without trying to populate rootFiles
        return project;
    }

    // Get all projects for user
    async getUserProjects(userId) {
        const projects = await Project.find({ owner: userId })
            .sort({ updatedAt: -1 })
            .select('-rootFiles');
        
        return projects;
    }

    // Get project details with file tree
    async getProject(projectId, userId) {
        const project = await Project.findOne({ _id: projectId, owner: userId });
        
        if (!project) {
            throw new Error('Project not found');
        }

        // Get fresh file tree
        const fileTree = await this.fsManager.getDirectoryTree(project.fileSystemPath);
        
        return {
            ...project.toObject(),
            fileTree
        };
    }

    // Read file from project
    async readFile(projectId, userId, filePath) {
        const project = await Project.findOne({ _id: projectId, owner: userId });
        
        if (!project) {
            throw new Error('Project not found');
        }

        return await this.fsManager.readFile(project.fileSystemPath, filePath);
    }

    // Write file to project
    async writeFile(projectId, userId, filePath, content) {
        const project = await Project.findOne({ _id: projectId, owner: userId });
        
        if (!project) {
            throw new Error('Project not found');
        }

        const result = await this.fsManager.writeFile(project.fileSystemPath, filePath, content);
        
        // Update project timestamp
        project.updatedAt = new Date();
        await project.save();

        return result;
    }

    // Delete file from project
    async deleteFile(projectId, userId, filePath) {
        const project = await Project.findOne({ _id: projectId, owner: userId });
        
        if (!project) {
            throw new Error('Project not found');
        }

        return await this.fsManager.deleteFile(project.fileSystemPath, filePath);
    }

    // Create directory
    async createDirectory(projectId, userId, dirPath) {
        const project = await Project.findOne({ _id: projectId, owner: userId });
        
        if (!project) {
            throw new Error('Project not found');
        }

        return await this.fsManager.createDirectory(project.fileSystemPath, dirPath);
    }

    // Rename file or directory
    async rename(projectId, userId, oldPath, newPath) {
        const project = await Project.findOne({ _id: projectId, owner: userId });
        
        if (!project) {
            throw new Error('Project not found');
        }

        return await this.fsManager.rename(project.fileSystemPath, oldPath, newPath);
    }

    // Delete project
    async deleteProject(projectId, userId) {
        try {
            console.log('deleting project:', projectId, 'for user:', userId);
            
            const project = await Project.findOne({ _id: projectId, owner: userId });
            
            if (!project) {
                console.log('project not found');
                throw new Error('Project not found');
            }

            console.log('found project:', project.name);

            // Delete from filesystem
            try {
                await this.fsManager.deleteProject(userId, projectId);
                console.log('filesystem deleted');
            } catch (fsError) {
                console.log('filesystem delete error:', fsError.message);
                // Continue even if filesystem delete fails
            }

            // Remove from user's projects
            await User.findByIdAndUpdate(userId, {
                $pull: { projects: projectId }
            });
            console.log('removed from user projects');

            // Delete database record
            await Project.findByIdAndDelete(projectId);
            console.log('database record deleted');

            return { deleted: true };
        } catch (error) {
            console.log('delete project error:', error);
            throw error;
        }
    }

    // Update project metadata
    async updateProjectMetadata(projectId, userId) {
        const project = await Project.findOne({ _id: projectId, owner: userId });
        
        if (!project) {
            throw new Error('Project not found');
        }

        const stats = await this.fsManager.getProjectStats(project.fileSystemPath);
        
        project.metadata.filesCount = stats.filesCount;
        project.metadata.totalSize = stats.totalSize;
        project.metadata.lastOpened = new Date();
        
        await project.save();

        return project;
    }
}

module.exports = new WorkspaceManager();
