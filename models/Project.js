const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['html', 'react', 'vue', 'node', 'nextjs', 'vite', 'web', 'custom'],
        default: 'html'
    },
    framework: {
        name: String,
        version: String
    },
    fileSystemPath: {
        type: String,
        required: true
    },
    rootFiles: [{
        name: String,
        path: String,
        type: String,
        size: Number,
        isDirectory: Boolean
    }],
    settings: {
        port: {
            type: Number,
            default: 3000
        },
        autoSave: {
            type: Boolean,
            default: true
        },
        livePreview: {
            type: Boolean,
            default: true
        }
    },
    deployment: {
        netlifyId: String,
        backendUrl: String,
        lastDeployed: Date
    },
    container: {
        containerId: String,
        status: {
            type: String,
            enum: ['stopped', 'starting', 'running', 'error'],
            default: 'stopped'
        },
        previewUrl: String,
        lastStarted: Date
    },
    metadata: {
        filesCount: {
            type: Number,
            default: 0
        },
        totalSize: {
            type: Number,
            default: 0
        },
        lastOpened: Date,
        isStarred: {
            type: Boolean,
            default: false
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
projectSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Index for faster queries
projectSchema.index({ owner: 1, createdAt: -1 });
projectSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Project', projectSchema);
