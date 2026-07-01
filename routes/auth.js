const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, auth } = require('../middleware/auth');

// In-memory fallback (if DB not connected)
const inMemoryUsers = [];
let userIdCounter = 1;

// Signup endpoint
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        // Try MongoDB first
        try {
            // Check if user exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: 'User with this email already exists' });
            }

            // Create new user
            const user = new User({ name, email, password });
            await user.save();

            // Generate token
            const token = generateToken(user._id);

            res.json({
                success: true,
                message: 'User created successfully',
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email
                }
            });
        } catch (dbError) {
            // Fallback to in-memory
            console.log('Using in-memory storage for signup');
            
            if (inMemoryUsers.find(u => u.email === email)) {
                return res.status(400).json({ error: 'User with this email already exists' });
            }

            const userId = `user_${userIdCounter++}`;
            const newUser = {
                id: userId,
                name,
                email,
                password,
                createdAt: new Date().toISOString()
            };

            inMemoryUsers.push(newUser);

            res.json({
                success: true,
                message: 'User created successfully',
                user: {
                    id: userId,
                    name,
                    email
                }
            });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Try MongoDB first
        try {
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            // Update last login
            user.lastLogin = new Date();
            await user.save();

            // Generate token
            const token = generateToken(user._id);

            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    settings: user.settings
                }
            });
        } catch (dbError) {
            // Fallback to in-memory
            console.log('Using in-memory storage for login');
            
            const user = inMemoryUsers.find(u => u.email === email);
            if (!user) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            if (user.password !== password) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            res.json({
                success: true,
                message: 'Login successful',
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get current user (protected route)
router.get('/me', auth, async (req, res) => {
    try {
        res.json({
            success: true,
            user: req.user
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Forgot password endpoint
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Try MongoDB first
        try {
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({ error: 'User not found with this email' });
            }

            // In production, send email with reset link
            res.json({
                success: true,
                message: 'Password recovery email sent'
            });
        } catch (dbError) {
            // Fallback to in-memory
            const user = inMemoryUsers.find(u => u.email === email);
            if (!user) {
                return res.status(404).json({ error: 'User not found with this email' });
            }

            res.json({
                success: true,
                message: 'Password recovery email sent',
                password: user.password // Only for demo
            });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

