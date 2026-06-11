const express = require('express');
const router = express.Router();

// In-memory user storage (array-based, replace with DB in production)
const users = [];

// Helper function to find user by email
const findUserByEmail = (email) => {
    return users.find(u => u.email === email);
};

// Helper function to generate simple user ID
let userIdCounter = 1;
const generateUserId = () => {
    return `user_${userIdCounter++}`;
};

// Signup endpoint
router.post('/signup', (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        // Check if user already exists
        if (findUserByEmail(email)) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        // Create new user
        const userId = generateUserId();
        const newUser = {
            id: userId,
            name,
            email,
            password, // In production, hash this password!
            createdAt: new Date().toISOString()
        };

        users.push(newUser);

        res.json({
            success: true,
            message: 'User created successfully',
            user: {
                id: userId,
                name,
                email
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login endpoint
router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
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

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Forgot password endpoint
router.post('/forgot-password', (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Find user
        const user = findUserByEmail(email);
        if (!user) {
            return res.status(404).json({ error: 'User not found with this email' });
        }

        // In production, send email with reset link
        // For now, just return the password (NOT SECURE - for demo only)
        res.json({
            success: true,
            message: 'Password recovery email sent',
            // In demo, we return password directly
            password: user.password
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
