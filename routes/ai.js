const express = require('express');
const router = express.Router();
const { ChatOpenAI } = require('@langchain/openai');
const { ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');

// AI Provider Configuration
const AI_PROVIDER = process.env.AI_PROVIDER || 'groq'; // Options: groq, deepseek, openai, gemini

const getAIModel = () => {
    switch (AI_PROVIDER) {
        case 'groq':
            // Groq - FREE, Fast, Unlimited (14,400 req/day)
            return new ChatOpenAI({
                model: "llama-3.3-70b-versatile",
                apiKey: process.env.GROQ_API_KEY || "gsk_your_groq_api_key_here",
                configuration: {
                    baseURL: "https://api.groq.com/openai/v1",
                },
            });
        
        case 'deepseek':
            // DeepSeek via HuggingFace (current setup)
            return new ChatOpenAI({
                model: "deepseek-ai/DeepSeek-V4-Pro:novita",
                apiKey: process.env.HF_TOKEN,
                configuration: {
                    baseURL: "https://router.huggingface.co/v1",
                },
            });
        
        case 'gemini':
            // Google Gemini - FREE with good limits
            return new ChatOpenAI({
                model: "gemini-1.5-flash",
                apiKey: process.env.GOOGLE_API_KEY,
                configuration: {
                    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
                },
            });
        
        case 'openai':
            // OpenAI (paid but high quality)
            return new ChatOpenAI({
                model: "gpt-4o-mini",
                apiKey: process.env.OPENAI_API_KEY,
            });
        
        default:
            // Default to Groq (best free option)
            return new ChatOpenAI({
                model: "llama-3.3-70b-versatile",
                apiKey: process.env.GROQ_API_KEY || "gsk_your_groq_api_key_here",
                configuration: {
                    baseURL: "https://api.groq.com/openai/v1",
                },
            });
    }
};

const model = getAIModel();

console.log(`Using AI Provider: ${AI_PROVIDER}`);

// Chat history store - last 5 chats per session
const chatHistories = new Map();

// Prompt template with chat history
const promptTemplate = ChatPromptTemplate.fromMessages([
    new SystemMessage("You are Saurabh, a code improvement assistant. Given code and user requests, return ONLY the improved code as JSON. Format: {\"code\": \"improved_code_here\"}. No explanations, no markdown formatting."),
    new MessagesPlaceholder("chat_history"),
    ["human", "Original Code:\n{code}\n\nUser Request: {prompt}\n\nReturn improved code as JSON with 'code' field:"]
]);

// Chat endpoint - pure conversation
router.post('/chat', async (req, res) => {
    try {
        const { message, sessionId = 'default' } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'message is required' });
        }

        const chatPrompt = ChatPromptTemplate.fromMessages([
            new SystemMessage("You are Saurabh, a helpful coding assistant. Answer questions about programming, coding concepts, best practices, debugging, and technical topics. Be friendly and concise."),
            ["human", "{message}"]
        ]);

        const chain = chatPrompt.pipe(model);
        const response = await chain.invoke({
            message: message
        });

        res.json({ 
            reply: response.content.trim()
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Code generation endpoint
router.post('/generate-code', async (req, res) => {
    try {
        const { code, prompt, sessionId = 'default' } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' });
        }

        if (!chatHistories.has(sessionId)) {
            chatHistories.set(sessionId, []);
        }
        const chatHistory = chatHistories.get(sessionId);

        const chain = promptTemplate.pipe(model);
        const response = await chain.invoke({
            code: code || "",
            prompt: prompt,
            chat_history: chatHistory
        });

        let generatedCode;
        try {
            const jsonMatch = response.content.match(/\{[\s\S]*"code"[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                generatedCode = parsed.code;
            } else {
                generatedCode = response.content.trim();
            }
        } catch (parseError) {
            generatedCode = response.content.trim();
        }

        chatHistory.push(new HumanMessage(`Code: ${(code || "").substring(0, 100)}...\nRequest: ${prompt}`));
        chatHistory.push(new AIMessage(generatedCode.substring(0, 100) + '...'));

        while (chatHistory.length > 10) {
            chatHistory.shift();
        }

        res.json({ 
            generatedCode,
            chatHistoryLength: chatHistory.length / 2
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Improve code endpoint
router.post('/improve-code', async (req, res) => {
    try {
        const { code, prompt, sessionId = 'default' } = req.body;

        if ( !prompt) {
            return res.status(400).json({ error: 'prompt are required' });
        }

        if (!chatHistories.has(sessionId)) {
            chatHistories.set(sessionId, []);
        }
        const chatHistory = chatHistories.get(sessionId);

        const chain = promptTemplate.pipe(model);
        const response = await chain.invoke({
            code: code,
            prompt: prompt,
            chat_history: chatHistory
        });

        let improvedCode;
        try {
            const jsonMatch = response.content.match(/\{[\s\S]*"code"[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                improvedCode = parsed.code;
            } else {
                improvedCode = response.content.trim();
            }
        } catch (parseError) {
            improvedCode = response.content.trim();
        }

        chatHistory.push(new HumanMessage(`Code: ${code.substring(0, 100)}...\nRequest: ${prompt}`));
        chatHistory.push(new AIMessage(improvedCode.substring(0, 100) + '...'));

        while (chatHistory.length > 10) {
            chatHistory.shift();
        }

        res.json({ 
            improvedCode,
            chatHistoryLength: chatHistory.length / 2
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Clear chat history endpoint
router.post('/clear-history', (req, res) => {
    const { sessionId = 'default' } = req.body;
    chatHistories.delete(sessionId);
    res.json({ message: 'Chat history cleared' });
});

module.exports = router;
