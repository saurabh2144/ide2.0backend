const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class FileSystemManager {
    constructor(workspacesRoot = path.join(__dirname, '../../workspaces')) {
        this.workspacesRoot = workspacesRoot;
        this.initializeWorkspaces();
    }

    async initializeWorkspaces() {
        try {
            await fs.mkdir(this.workspacesRoot, { recursive: true });
            console.log('Workspaces directory initialized');
        } catch (error) {
            console.error('Failed to initialize workspaces:', error);
        }
    }

    // Get user workspace path
    getUserWorkspacePath(userId) {
        return path.join(this.workspacesRoot, userId.toString());
    }

    // Get project path
    getProjectPath(userId, projectId) {
        return path.join(this.getUserWorkspacePath(userId), projectId.toString());
    }

    // Validate and sanitize path
    validatePath(basePath, targetPath) {
        const resolved = path.resolve(basePath, targetPath);
        if (!resolved.startsWith(basePath)) {
            throw new Error('Invalid path: Path traversal detected');
        }
        return resolved;
    }

    // Create user workspace
    async createUserWorkspace(userId) {
        const userPath = this.getUserWorkspacePath(userId);
        await fs.mkdir(userPath, { recursive: true });
        return userPath;
    }

    // Create new project
    async createProject(userId, projectId, projectName, projectType = 'web', shouldInitialize = true) {
        const projectPath = this.getProjectPath(userId, projectId);
        await fs.mkdir(projectPath, { recursive: true });

        // Create project metadata
        const metadata = {
            name: projectName,
            type: projectType,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ide_name: "aiDeployer by saurabh"
        };

        await this.writeFile(projectPath, '.project.json', JSON.stringify(metadata, null, 2));

        // Initialize with template files ONLY if shouldInitialize is true
        if (shouldInitialize) {
            await this.initializeTemplate(projectPath, projectType);
        }

        return projectPath;
    }

    // Initialize project with template
    async initializeTemplate(projectPath, template) {
        const templates = {
            html: {
                'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Project</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>Hello World!</h1>
        <p>Start building your project here.</p>
    </div>
    <script src="script.js"></script>
</body>
</html>`,
                'style.css': `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: Arial, sans-serif;
    padding: 20px;
    background: #f5f5f5;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    padding: 40px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

h1 {
    color: #333;
}`,
                'script.js': `console.log('Project initialized!');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');
});`
            },
            react: {
                'package.json': JSON.stringify({
                    name: 'react-project',
                    version: '0.1.0',
                    private: true,
                    dependencies: {
                        'react': '^18.2.0',
                        'react-dom': '^18.2.0',
                        'react-scripts': '5.0.1'
                    },
                    scripts: {
                        'start': 'react-scripts start',
                        'build': 'react-scripts build'
                    }
                }, null, 2),
                'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>React App</title>
</head>
<body>
    <div id="root"></div>
</body>
</html>`,
                'src/App.jsx': `import React from 'react';
import './App.css';

function App() {
    return (
        <div className="App">
            <h1>Hello React!</h1>
            <p>Start building your app here.</p>
        </div>
    );
}

export default App;`,
                'src/App.css': `.App {
    text-align: center;
    padding: 40px;
}`,
                'src/index.jsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`
            },
            express: {
                'package.json': JSON.stringify({
                    name: 'express-api-boilerplate',
                    version: '1.0.0',
                    main: 'server.js',
                    dependencies: {
                        'express': '^4.19.2',
                        'cors': '^2.8.5',
                        'dotenv': '^16.4.5'
                    },
                    scripts: {
                        'start': 'node server.js'
                    }
                }, null, 2),
                'server.js': `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Logger Middleware
app.use((req, res, next) => {
    console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.url}\`);
    next();
});

// Load routes
app.use('/api', require('./routes/api'));

app.get('/', (req, res) => {
    res.json({
        message: "Welcome to Express API Boilerplate!",
        status: "Running",
        endpoints: [
            "GET /api/health",
            "GET /api/items",
            "POST /api/items"
        ]
    });
});

app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
});`,
                'routes/api.js': `const express = require('express');
const router = express.Router();

let items = [
    { id: 1, name: 'Item One', description: 'Description for item one' },
    { id: 2, name: 'Item Two', description: 'Description for item two' }
];

router.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

router.get('/items', (req, res) => {
    res.json(items);
});

router.post('/items', (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    const newItem = {
        id: items.length + 1,
        name,
        description: description || ''
    };
    items.push(newItem);
    res.status(201).json(newItem);
});

module.exports = router;`
            },
            portfolio: {
                'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Portfolio</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header class="navbar">
        <div class="logo">Dev<span>Folio</span></div>
        <nav class="nav-links">
            <a href="#hero">Home</a>
            <a href="#about">About</a>
            <a href="#projects">Projects</a>
        </nav>
    </header>
    
    <section id="hero" class="hero-section">
        <div class="hero-content">
            <span class="badge">Open to Work</span>
            <h1>Hello, I'm a <span class="gradient-text">Full-Stack Engineer</span></h1>
            <p>I build premium, responsive web applications with a focus on modern design aesthetics, performance, and user experience.</p>
            <div class="hero-actions">
                <a href="#projects" class="btn primary">View Projects</a>
                <a href="#contact" class="btn secondary">Get in Touch</a>
            </div>
        </div>
    </section>

    <section id="projects" class="projects-section">
        <h2>My Featured <span class="gradient-text">Projects</span></h2>
        <div class="projects-grid">
            <div class="project-card">
                <div class="project-info">
                    <h3>AI Code Editor</h3>
                    <p>A web-based IDE featuring real-time file updates, file trees, and a smart AI agent to assist development.</p>
                    <span class="tech-tag">React</span> <span class="tech-tag">Express</span>
                </div>
            </div>
            <div class="project-card">
                <div class="project-info">
                    <h3>Analytics Dashboard</h3>
                    <p>Interactive data visualizations for marketing analytics featuring responsive charts and dark mode layouts.</p>
                    <span class="tech-tag">JavaScript</span> <span class="tech-tag">CSS3</span>
                </div>
            </div>
        </div>
    </section>
    
    <script src="script.js"></script>
</body>
</html>`,
                'style.css': `:root {
    --bg-dark: #0f172a;
    --text-light: #f8fafc;
    --text-muted: #94a3b8;
    --primary: #6366f1;
    --primary-hover: #4f46e5;
    --accent: #a855f7;
    --glass: rgba(30, 41, 59, 0.7);
    --border: rgba(255, 255, 255, 0.08);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Plus Jakarta Sans', sans-serif;
}

body {
    background-color: var(--bg-dark);
    color: var(--text-light);
    overflow-x: hidden;
    scroll-behavior: smooth;
}

.navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 8%;
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(12px);
    position: fixed;
    width: 100%;
    top: 0;
    z-index: 100;
    border-bottom: 1px solid var(--border);
}

.logo {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
}

.logo span {
    color: var(--primary);
}

.nav-links a {
    color: var(--text-muted);
    text-decoration: none;
    margin-left: 30px;
    font-weight: 600;
    font-size: 14px;
    transition: color 0.3s;
}

.nav-links a:hover {
    color: var(--text-light);
}

.hero-section {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 8%;
    padding-top: 100px;
    text-align: center;
}

.hero-content {
    max-width: 800px;
}

.badge {
    background: rgba(99, 102, 241, 0.15);
    color: var(--primary);
    padding: 6px 16px;
    border-radius: 99px;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid rgba(99, 102, 241, 0.3);
    margin-bottom: 24px;
    display: inline-block;
}

h1 {
    font-size: 56px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -2px;
    margin-bottom: 24px;
}

.gradient-text {
    background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.hero-content p {
    font-size: 18px;
    color: var(--text-muted);
    line-height: 1.6;
    margin-bottom: 40px;
}

.hero-actions {
    display: flex;
    gap: 16px;
    justify-content: center;
}

.btn {
    padding: 14px 28px;
    border-radius: 8px;
    font-weight: 600;
    text-decoration: none;
    font-size: 15px;
    transition: all 0.3s;
}

.btn.primary {
    background-color: var(--primary);
    color: white;
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
}

.btn.primary:hover {
    background-color: var(--primary-hover);
    transform: translateY(-2px);
}

.btn.secondary {
    border: 1px solid var(--border);
    color: var(--text-light);
    background-color: transparent;
}

.btn.secondary:hover {
    background-color: rgba(255, 255, 255, 0.05);
    transform: translateY(-2px);
}

.projects-section {
    padding: 80px 8%;
}

.projects-section h2 {
    font-size: 36px;
    text-align: center;
    font-weight: 800;
    margin-bottom: 50px;
}

.projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
}

.project-card {
    background-color: var(--glass);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 32px;
    transition: all 0.3s;
    cursor: pointer;
}

.project-card:hover {
    transform: translateY(-6px);
    border-color: rgba(99, 102, 241, 0.4);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
}

.project-card h3 {
    font-size: 20px;
    margin-bottom: 12px;
}

.project-card p {
    color: var(--text-muted);
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 24px;
}

.tech-tag {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    background: rgba(255,255,255,0.05);
    padding: 4px 10px;
    border-radius: 4px;
    margin-right: 6px;
}
`,
                'script.js': `console.log("Portfolio Template Initialized!");

document.addEventListener("DOMContentLoaded", () => {
    const cards = document.querySelectorAll(".project-card");
    cards.forEach((card, index) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(20px)";
        card.style.transition = "all 0.6s ease-out";
        
        setTimeout(() => {
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";
        }, 150 * (index + 1));
    });
});`
            },
            todo: {
                'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Tracker</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="todo-app">
        <header>
            <h1>Task Tracker</h1>
            <p>Manage your daily duties efficiently</p>
        </header>

        <form id="todo-form">
            <input type="text" id="todo-input" placeholder="What needs to be done?" required>
            <button type="submit">Add Task</button>
        </form>

        <ul id="todo-list">
            <!-- Todos get rendered here -->
        </ul>
    </div>
    
    <script src="script.js"></script>
</body>
</html>`,
                'style.css': `:root {
    --bg: #f3f4f6;
    --card-bg: #ffffff;
    --text: #1f2937;
    --text-muted: #6b7280;
    --primary: #3b82f6;
    --primary-hover: #2563eb;
    --border: #e5e7eb;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Inter', sans-serif;
}

body {
    background-color: var(--bg);
    color: var(--text);
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 20px;
}

.todo-app {
    background: var(--card-bg);
    padding: 32px;
    border-radius: 16px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
    max-width: 500px;
    width: 100%;
}

header {
    margin-bottom: 24px;
    text-align: center;
}

header h1 {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.5px;
    margin-bottom: 6px;
}

header p {
    font-size: 14px;
    color: var(--text-muted);
}

#todo-form {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
}

#todo-input {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
}

#todo-input:focus {
    border-color: var(--primary);
}

#todo-form button {
    padding: 12px 20px;
    background-color: var(--primary);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
}

#todo-form button:hover {
    background-color: var(--primary-hover);
}

#todo-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.todo-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg);
    border-radius: 8px;
    border: 1px solid var(--border);
    transition: opacity 0.3s;
}

.todo-item.completed span {
    text-decoration: line-through;
    color: var(--text-muted);
}

.todo-item span {
    font-size: 14px;
    font-weight: 500;
}

.todo-item-actions {
    display: flex;
    gap: 8px;
}

.todo-item-actions button {
    border: none;
    background: none;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 4px;
}

.complete-btn {
    color: var(--primary);
}

.delete-btn {
    color: #ef4444;
}
`,
                'script.js': `document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("todo-form");
    const input = document.getElementById("todo-input");
    const list = document.getElementById("todo-list");

    let todos = JSON.parse(localStorage.getItem("todos")) || [
        { text: "Learn LangGraph JS", completed: false },
        { text: "Build premium Web IDE app", completed: true }
    ];

    const saveToLocalStorage = () => {
        localStorage.setItem("todos", JSON.stringify(todos));
    };

    const renderTodos = () => {
        list.innerHTML = "";
        todos.forEach((todo, index) => {
            const li = document.createElement("li");
            li.className = \`todo-item \${todo.completed ? 'completed' : ''}\`;
            
            li.innerHTML = \`
                <span>\${todo.text}</span>
                <div class="todo-item-actions">
                    <button class="complete-btn">\${todo.completed ? 'Undo' : 'Complete'}</button>
                    <button class="delete-btn">Delete</button>
                </div>
            \`;

            li.querySelector(".complete-btn").addEventListener("click", () => {
                todos[index].completed = !todos[index].completed;
                saveToLocalStorage();
                renderTodos();
            });

            li.querySelector(".delete-btn").addEventListener("click", () => {
                todos.splice(index, 1);
                saveToLocalStorage();
                renderTodos();
            });

            list.appendChild(li);
        });
    };

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) {
            todos.push({ text, completed: false });
            saveToLocalStorage();
            renderTodos();
            input.value = "";
        }
    });

    renderTodos();
});`
            }
        };

        const templateFiles = templates[template] || templates.html;

        for (const [filePath, content] of Object.entries(templateFiles)) {
            await this.writeFile(projectPath, filePath, content);
        }
    }

    // Read file
    async readFile(basePath, filePath) {
        const fullPath = this.validatePath(basePath, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const stats = await fs.stat(fullPath);
        
        return {
            content,
            size: stats.size,
            modified: stats.mtime
        };
    }

    // Write file
    async writeFile(basePath, filePath, content) {
        const fullPath = this.validatePath(basePath, filePath);
        const dir = path.dirname(fullPath);
        
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');
        
        const stats = await fs.stat(fullPath);
        return {
            path: filePath,
            size: stats.size,
            modified: stats.mtime
        };
    }

    // Delete file
    async deleteFile(basePath, filePath) {
        const fullPath = this.validatePath(basePath, filePath);
        await fs.unlink(fullPath);
        return { deleted: true, path: filePath };
    }

    // Create directory
    async createDirectory(basePath, dirPath) {
        const fullPath = this.validatePath(basePath, dirPath);
        await fs.mkdir(fullPath, { recursive: true });
        return { created: true, path: dirPath };
    }

    // Delete directory
    async deleteDirectory(basePath, dirPath) {
        const fullPath = this.validatePath(basePath, dirPath);
        await fs.rm(fullPath, { recursive: true, force: true });
        return { deleted: true, path: dirPath };
    }

    // Rename/Move file or directory
    async rename(basePath, oldPath, newPath) {
        const fullOldPath = this.validatePath(basePath, oldPath);
        const fullNewPath = this.validatePath(basePath, newPath);
        
        const newDir = path.dirname(fullNewPath);
        await fs.mkdir(newDir, { recursive: true });
        
        await fs.rename(fullOldPath, fullNewPath);
        return { renamed: true, from: oldPath, to: newPath };
    }

    // Get directory tree
    async getDirectoryTree(basePath, relativePath = '.', maxDepth = 10, currentDepth = 0) {
        if (currentDepth >= maxDepth) {
            return [];
        }

        const fullPath = this.validatePath(basePath, relativePath);
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        
        const tree = [];

        for (const entry of entries) {
            // Skip hidden files and common ignore patterns
            if (entry.name.startsWith('.') && entry.name !== '.project.json') continue;
            if (['node_modules', 'dist', 'build', '.git'].includes(entry.name)) continue;

            const entryPath = path.join(relativePath, entry.name);
            const stats = await fs.stat(path.join(fullPath, entry.name));

            const item = {
                name: entry.name,
                path: entryPath,
                type: entry.isDirectory() ? 'directory' : 'file',
                size: stats.size,
                modified: stats.mtime,
                isDirectory: entry.isDirectory()
            };

            if (entry.isDirectory()) {
                item.children = await this.getDirectoryTree(
                    basePath,
                    entryPath,
                    maxDepth,
                    currentDepth + 1
                );
            }

            tree.push(item);
        }

        return tree.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
    }

    // Get project statistics
    async getProjectStats(projectPath) {
        let filesCount = 0;
        let totalSize = 0;

        const processDir = async (dirPath) => {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.name.startsWith('.')) continue;
                if (['node_modules', 'dist', 'build'].includes(entry.name)) continue;

                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    await processDir(fullPath);
                } else {
                    filesCount++;
                    const stats = await fs.stat(fullPath);
                    totalSize += stats.size;
                }
            }
        };

        await processDir(projectPath);

        return { filesCount, totalSize };
    }

    // Delete project
    async deleteProject(userId, projectId) {
        const projectPath = this.getProjectPath(userId, projectId);
        await fs.rm(projectPath, { recursive: true, force: true });
        return { deleted: true };
    }
}

module.exports = new FileSystemManager();
