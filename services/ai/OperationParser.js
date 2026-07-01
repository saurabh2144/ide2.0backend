class OperationParser {
    parse(aiResponse) {
        const operations = [];

        // Try to extract operations block
        const operationsMatch = aiResponse.match(/```operations\n([\s\S]*?)\n```/);
        
        if (operationsMatch) {
            try {
                const opsArray = JSON.parse(operationsMatch[1]);
                return this.validateOperations(opsArray);
            } catch (error) {
                console.error('Failed to parse operations block:', error);
            }
        }

        // Fallback: Try to extract JSON array
        const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
            try {
                const opsArray = JSON.parse(jsonMatch[0]);
                return this.validateOperations(opsArray);
            } catch (error) {
                console.error('Failed to parse JSON:', error);
            }
        }

        // Fallback: Try to extract individual code blocks as file updates
        const codeBlocks = aiResponse.matchAll(/```(\w+)?\s*\n\/\/\s*File:\s*(.+?)\n([\s\S]*?)```/g);
        
        for (const match of codeBlocks) {
            const filePath = match[2].trim();
            const content = match[3].trim();
            
            operations.push({
                type: 'update',
                path: filePath,
                content: content,
                reason: 'Generated from code block'
            });
        }

        return operations;
    }

    validateOperations(operations) {
        const validated = [];

        if (!Array.isArray(operations)) {
            return validated;
        }

        for (const op of operations) {
            if (!op.type || !op.path) {
                continue;
            }

            if (!['create', 'update', 'delete'].includes(op.type)) {
                continue;
            }

            if ((op.type === 'create' || op.type === 'update') && !op.content) {
                continue;
            }

            validated.push({
                type: op.type,
                path: op.path,
                content: op.content || '',
                reason: op.reason || 'No reason provided'
            });
        }

        return validated;
    }

    extractSummary(aiResponse) {
        // Try to find summary section
        const summaryMatch = aiResponse.match(/SUMMARY:?\s*(.+?)(?:\n\n|$)/i);
        if (summaryMatch) {
            return summaryMatch[1].trim();
        }

        // Use first paragraph as summary
        const firstParagraph = aiResponse.split('\n\n')[0];
        if (firstParagraph && firstParagraph.length < 500) {
            return firstParagraph.replace(/```/g, '').trim();
        }

        return 'Changes applied successfully';
    }
}

module.exports = new OperationParser();
