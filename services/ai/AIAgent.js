const axios = require('axios');
const ContextManager = require('./ContextManager');
const OperationParser = require('./OperationParser');
const WorkspaceManager = require('../workspace/WorkspaceManager');

class AIAgent {
    constructor() {
        this.groqApiKey = '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';
        this.model = 'llama-3.3-70b-versatile';
        this.contextManager = ContextManager;
        this.operationParser = OperationParser;
    }

    async callLLM(messages, llmConfig) {
        const provider = llmConfig?.provider || 'default';
        const apiKey = llmConfig?.apiKey;
        const model = llmConfig?.model;

        if (provider === 'default') {
            // Use default Groq
            const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model: this.model,
                    messages,
                    temperature: 0.3,
                    max_tokens: 4000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.groqApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return {
                reply: response.data.choices[0].message.content,
                usage: response.data.usage
            };
        }

        if (!apiKey) {
            throw new Error(`API Key is required for provider: ${provider}`);
        }

        if (provider === 'groq') {
            const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model: model || 'llama-3.3-70b-versatile',
                    messages,
                    temperature: 0.3,
                    max_tokens: 4000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return {
                reply: response.data.choices[0].message.content,
                usage: response.data.usage
            };
        }

        if (provider === 'openai') {
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: model || 'gpt-4o-mini',
                    messages,
                    temperature: 0.3,
                    max_tokens: 4000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return {
                reply: response.data.choices[0].message.content,
                usage: response.data.usage
            };
        }

        if (provider === 'deepseek') {
            const response = await axios.post(
                'https://api.deepseek.com/chat/completions',
                {
                    model: model || 'deepseek-chat',
                    messages,
                    temperature: 0.3,
                    max_tokens: 4000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return {
                reply: response.data.choices[0].message.content,
                usage: response.data.usage
            };
        }

        if (provider === 'gemini') {
            const geminiModel = model || 'gemini-1.5-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
            
            // Format messages to Gemini layout
            const systemMessage = messages.find(m => m.role === 'system');
            const otherMessages = messages.filter(m => m.role !== 'system');
            
            const contents = otherMessages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

            const body = {
                contents,
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 4000
                }
            };

            if (systemMessage) {
                body.systemInstruction = {
                    parts: [{ text: systemMessage.content }]
                };
            }

            const response = await axios.post(url, body, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new Error('Invalid response format from Gemini API: ' + JSON.stringify(response.data));
            }

            return {
                reply: response.data.candidates[0].content.parts[0].text,
                usage: {
                    prompt_tokens: response.data.usageMetadata?.promptTokenCount || 0,
                    completion_tokens: response.data.usageMetadata?.candidatesTokenCount || 0,
                    total_tokens: response.data.usageMetadata?.totalTokenCount || 0
                }
            };
        }

        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    // Chat mode - conversational AI
    async chat(message, conversationHistory = [], llmConfig) {
        try {
            const messages = [
                {
                    role: 'system',
                    content: 'You are a helpful AI coding assistant. Answer questions about programming, provide code examples, and help debug issues.'
                },
                ...conversationHistory,
                {
                    role: 'user',
                    content: message
                }
            ];

            return await this.callLLM(messages, llmConfig);
        } catch (error) {
            console.error('AI Chat Error:', error.response?.data || error.message);
            throw new Error('Failed to get AI response: ' + (error.response?.data?.error?.message || error.message));
        }
    }

    // Agent mode - performs actions on codebase
    async executeTask(projectId, userId, task, llmConfig) {
        try {
            console.log('Stage 1: Reading project files...');
            const context = await this.contextManager.buildProjectContext(projectId, userId);

            console.log('running code runner...');
            const { executeLangGraphTask } = require('./LangGraphAgent');
            const result = await executeLangGraphTask(context, task, llmConfig);

            return {
                success: result.success,
                operations: result.operations,
                summary: result.summary,
                errors: result.errors,
                iterations: result.iterations,
                filesChanged: result.operations?.length || 0
            };

        } catch (error) {
            console.error('AI Agent Error:', error);
            throw error;
        }
    }

    buildSystemPrompt(context) {
        return `You are an expert full-stack developer AI agent. You have access to a project and can perform file operations.

PROJECT STRUCTURE:
${context.structure}

CURRENT FILES:
${context.filesContent}

INSTRUCTIONS:
1. Analyze the user's request carefully
2. Plan the necessary file operations (create, update, delete)
3. Respond with structured operations in this EXACT format:

\`\`\`operations
[
  {
    "type": "create|update|delete",
    "path": "relative/path/to/file.js",
    "content": "full file content here (for create/update)",
    "reason": "brief explanation"
  }
]
\`\`\`

RULES:
- Always provide COMPLETE file content, never use "..." or placeholders
- Use proper file paths relative to project root
- Include clear reasons for each operation
- For updates, provide the ENTIRE updated file content
- Only suggest operations that directly address the user's request
- Ensure code follows best practices and is production-ready`;
    }

    buildTaskPrompt(task, context) {
        return `TASK: ${task}

Please analyze the project and generate the necessary file operations to complete this task.
Remember to respond with the structured operations format.`;
    }

    async executeOperation(projectId, userId, operation) {
        const { type, path, content } = operation;

        switch (type) {
            case 'create':
            case 'update':
                return await WorkspaceManager.writeFile(projectId, userId, path, content);
            
            case 'delete':
                return await WorkspaceManager.deleteFile(projectId, userId, path);
            
            default:
                throw new Error(`Unknown operation type: ${type}`);
        }
    }

    // Generate code for a specific file
    async generateCode(currentCode, prompt, llmConfig) {
        try {
            const messages = [
                {
                    role: 'system',
                    content: 'You are a code generation AI. Generate or modify code based on user requests. Return only the code, no explanations.'
                },
                {
                    role: 'user',
                    content: `Current code:\n\`\`\`\n${currentCode}\n\`\`\`\n\nRequest: ${prompt}\n\nGenerate the complete updated code:`
                }
            ];

            const result = await this.callLLM(messages, llmConfig);
            let generatedCode = result.reply;

            // Extract code from markdown blocks if present
            const codeBlockMatch = generatedCode.match(/```[\w]*\n([\s\S]*?)\n```/);
            if (codeBlockMatch) {
                generatedCode = codeBlockMatch[1];
            }

            return {
                generatedCode,
                usage: response.data.usage
            };
        } catch (error) {
            console.error('Code Generation Error:', error.response?.data || error.message);
            throw new Error('Failed to generate code: ' + (error.response?.data?.error?.message || error.message));
        }
    }

    // Execute task on provided files array (no database/filesystem needed)
    async executeTaskOnFiles(files, task, llmConfig) {
        try {
            console.log('starting execution runner...');
            console.log('Task:', task);
            console.log('Files:', files.length);

            // build context from files
            console.log('building file context...');
            const context = this.buildContextFromFiles(files);

            console.log('running graph flow...');
            const { executeLangGraphTask } = require('./LangGraphAgent');
            const result = await executeLangGraphTask(context, task, llmConfig);

            return {
                success: result.success,
                operations: result.operations,
                summary: result.summary,
                errors: result.errors,
                iterations: result.iterations,
                filesChanged: result.operations?.length || 0
            };

        } catch (error) {
            console.error('AI Agent Error:', error);
            throw error;
        }
    }

    buildContextFromFiles(files) {
        // Build file tree string
        const structure = files.map(f => `📄 ${f.filename}`).join('\n');

        // Build files content string
        const filesContent = files.map(f => 
            `\n=== ${f.filename} ===\n${f.content || '// Empty file'}\n`
        ).join('\n');

        return {
            projectName: 'Current Workspace',
            projectType: 'web',
            structure: structure,
            filesContent: filesContent,
            fileCount: files.length
        };
    }
}

module.exports = new AIAgent();
