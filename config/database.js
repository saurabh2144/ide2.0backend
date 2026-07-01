const mongoose = require('mongoose');

const connectDatabase = async () => {
    try {
        const mongoURI = 'mongodb+srv://admin:admin@cluster0.8xvuysd.mongodb.net/webide?retryWrites=true&w=majority';
        
        await mongoose.connect(mongoURI);

        console.log('MongoDB connected successfully');
        
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        // Don't exit - allow fallback to in-memory mode
        console.log('Continuing with in-memory storage...');
    }
};

module.exports = { connectDatabase };
