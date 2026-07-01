const mongoose = require('mongoose');

const containerSchema = new mongoose.Schema({
    containerId: {
        type: String,
        required: true,
        unique: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['creating', 'running', 'stopped', 'error', 'cleaning'],
        default: 'creating'
    },
    image: {
        type: String,
        required: true
    },
    ports: {
        internal: Number,
        external: Number
    },
    resources: {
        cpuLimit: {
            type: Number,
            default: 1 // 1 CPU core
        },
        memoryLimit: {
            type: String,
            default: '512m'
        }
    },
    environment: [{
        key: String,
        value: String
    }],
    logs: {
        lastLines: [String],
        errorCount: {
            type: Number,
            default: 0
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastUsed: {
        type: Date,
        default: Date.now
    },
    autoCleanup: {
        type: Boolean,
        default: true
    },
    cleanupAfter: {
        type: Number,
        default: 3600000 // 1 hour in milliseconds
    }
});

// Index for cleanup queries
containerSchema.index({ lastUsed: 1, autoCleanup: 1 });
containerSchema.index({ project: 1 });

module.exports = mongoose.model('Container', containerSchema);
