const WorkspaceManager = require('../workspace/WorkspaceManager');
const ignore = require('ignore');
const path = require('path');

class ContextManager {
    constructor() {
        this.maxTokens = 15000; // Conservative limit for context
        this.ignorePatterns = [
            'node_modules/**',
            'dist/**',
            'build/**',
            '.git/**',
            '*.log',
            'package-lock.json',
            'yarn.lock',
            '.env',
            '.env.*',
            '*.min.js',
            '*.min.css',
            '*.map'
        ];
    }

    // Build project context for AI
    async buildProjectContext(projectId, userId) {
        const project = await WorkspaceManager.getProject(projectId, userId);
        
        // Get file tree
        const fileTree = project.fileTree || [];
        
        // Build structure overview
        const structure = this.buildStructureString(fileTree);
        
        // Select relevant files
        const relevantFiles = this.selectRelevantFiles(fileTree);
        
        // Read file contents
        const filesContent = await this.readFiles(projectId, userId, relevantFiles);
        
        return {
            projectName: project.name,
            projectType: project.type,
            structure,
            filesContent,
            fileCount: relevantFiles.length
        };
    }

    // Build human-readable structure string
    buildStructureString(fileTree, prefix = '', result = []) {
        fileTree.forEach((item, index) => {
            const isLast = index === fileTree.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const icon = item.isDirectory ? '📁 ' : '📄 ';
            
            result.push(prefix + connector + icon + item.name);
            
            if (item.children && item.children.length > 0) {
                const newPrefix = prefix + (isLast ? '    ' : '│   ');
                this.buildStructureString(item.children, newPrefix, result);
            }
        });
        
        return result.join('\n');
    }

    // Select relevant files (exclude node_modules, etc.)
    selectRelevantFiles(fileTree, basePath = '', result = []) {
        const ig = ignore().add(this.ignorePatterns);
        
        fileTree.forEach(item => {
            const itemPath = path.join(basePath, item.name);
            
            if (ig.ignores(itemPath)) {
                return;
            }
            
            if (item.isDirectory && item.children) {
                this.selectRelevantFiles(item.children, itemPath, result);
            } else if (!item.isDirectory) {
                // Prioritize important files
                const priority = this.getFilePriority(item.name);
                result.push({
                    path: itemPath,
                    name: item.name,
                    priority,
                    size: item.size
                });
            }
        });
        
        // Sort by priority and size
        result.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return a.size - b.size; // Smaller files first
        });
        
        // Limit number of files to stay under token limit
        return result.slice(0, 30).map(f => f.path);
    }

    // Get file priority (higher = more important)
    getFilePriority(filename) {
        const ext = path.extname(filename);
        
        // High priority
        if (['package.json', 'tsconfig.json', 'vite.config.js', 'next.config.js'].includes(filename)) {
            return 100;
        }
        
        // Medium priority
        if (['.js', '.jsx', '.ts', '.tsx', '.vue', '.py'].includes(ext)) {
            return 50;
        }
        
        if (['.html', '.css', '.scss'].includes(ext)) {
            return 40;
        }
        
        // Low priority
        if (['.json', '.md', '.txt'].includes(ext)) {
            return 20;
        }
        
        return 10;
    }

    // Read selected files
    async readFiles(projectId, userId, filePaths) {
        const filesContent = [];
        
        for (const filePath of filePaths) {
            try {
                const fileData = await WorkspaceManager.readFile(projectId, userId, filePath);
                
                // Skip very large files
                if (fileData.content.length > 10000) {
                    filesContent.push(`// File: ${filePath}\n// [Content truncated - file too large]`);
                    continue;
                }
                
                filesContent.push(`// File: ${filePath}\n${fileData.content}`);
            } catch (error) {
                console.error(`Failed to read file ${filePath}:`, error.message);
            }
        }
        
        return filesContent.join('\n\n---\n\n');
    }

    // Estimate token count (rough approximation)
    estimateTokens(text) {
        // Rough estimate: 1 token ≈ 4 characters
        return Math.ceil(text.length / 4);
    }

    // Build minimal context for specific files
    async buildMinimalContext(projectId, userId, filePaths) {
        const filesContent = await this.readFiles(projectId, userId, filePaths);
        
        return {
            filesContent,
            fileCount: filePaths.length
        };
    }

    // Extract relevant files based on task description
    async extractRelevantFiles(projectId, userId, taskDescription) {
        const project = await WorkspaceManager.getProject(projectId, userId);
        const fileTree = project.fileTree || [];
        
        // Extract keywords from task
        const keywords = this.extractKeywords(taskDescription);
        
        // Score files based on relevance
        const scoredFiles = [];
        this.scoreFiles(fileTree, '', keywords, scoredFiles);
        
        // Sort by score and take top files
        scoredFiles.sort((a, b) => b.score - a.score);
        
        return scoredFiles.slice(0, 10).map(f => f.path);
    }

    extractKeywords(text) {
        // Simple keyword extraction
        const words = text.toLowerCase().match(/\b\w+\b/g) || [];
        return [...new Set(words)].filter(w => w.length > 3);
    }

    scoreFiles(fileTree, basePath, keywords, result) {
        fileTree.forEach(item => {
            const itemPath = path.join(basePath, item.name);
            
            if (item.isDirectory && item.children) {
                this.scoreFiles(item.children, itemPath, keywords, result);
            } else if (!item.isDirectory) {
                let score = 0;
                
                // Score based on filename matches
                const lowerPath = itemPath.toLowerCase();
                keywords.forEach(keyword => {
                    if (lowerPath.includes(keyword)) {
                        score += 10;
                    }
                });
                
                // Bonus for file type
                score += this.getFilePriority(item.name);
                
                if (score > 0) {
                    result.push({
                        path: itemPath,
                        name: item.name,
                        score
                    });
                }
            }
        });
    }
}

module.exports = new ContextManager();
