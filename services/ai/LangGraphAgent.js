const { StateGraph, Annotation, START, END } = require('@langchain/langgraph');
const vm = require('vm');

// state definition
const GraphState = Annotation.Root({
    context: Annotation({ reducer: (x, y) => y }),
    task: Annotation({ reducer: (x, y) => y }),
    llmConfig: Annotation({ reducer: (x, y) => y }),
    operations: Annotation({ reducer: (x, y) => y, default: () => [] }),
    errors: Annotation({ reducer: (x, y) => y, default: () => [] }),
    iterations: Annotation({ reducer: (x, y) => y, default: () => 0 }),
    maxIterations: Annotation({ reducer: (x, y) => y, default: () => 3 }),
    success: Annotation({ reducer: (x, y) => y, default: () => false }),
    summary: Annotation({ reducer: (x, y) => y, default: () => '' })
});

// node 1: call llm
const planAndGenerate = async (state) => {
    console.log("running generate loop - iteration " + (state.iterations + 1));
    const AIAgent = require('./AIAgent');
    
    let correctionContext = "";
    if (state.errors && state.errors.length > 0) {
        console.log("found validation errors from last run:");
        correctionContext = "\n\nFix these syntax errors from the last attempt:\n";
        state.errors.forEach((err, idx) => {
            console.log(" - " + err.path + ": " + err.message);
            correctionContext += `- File: ${err.path}, Error: ${err.message}\n`;
        });
        correctionContext += "\nMake sure you fix these compile issues in the final code.\n";
    }

    const systemPrompt = AIAgent.buildSystemPrompt(state.context);
    const userPrompt = AIAgent.buildTaskPrompt(state.task, state.context) + correctionContext;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    console.log("sending prompt...");
    const result = await AIAgent.callLLM(messages, state.llmConfig);
    const aiResponse = result.reply;

    console.log("parsing output...");
    const operations = AIAgent.operationParser.parse(aiResponse);
    const summary = AIAgent.operationParser.extractSummary(aiResponse);

    return {
        operations,
        iterations: state.iterations + 1,
        summary
    };
};

// node 2: check syntax
const verifyCode = async (state) => {
    console.log("checking files...");
    const errors = [];

    if (!state.operations || state.operations.length === 0) {
        errors.push({
            path: 'operations_check',
            message: 'No changes returned.'
        });
        return { errors, success: false };
    }

    for (const op of state.operations) {
        if ((op.type === 'create' || op.type === 'update') && op.content) {
            const ext = op.path.split('.').pop().toLowerCase();
            
            // check js files
            if (ext === 'js' || ext === 'jsx') {
                try {
                    new vm.Script(op.content);
                } catch (err) {
                    console.log("syntax error in " + op.path + ": " + err.message);
                    errors.push({
                        path: op.path,
                        message: err.message
                    });
                }
            }
            
            // check json
            if (ext === 'json') {
                try {
                    JSON.parse(op.content);
                } catch (err) {
                    console.log("json error in " + op.path + ": " + err.message);
                    errors.push({
                        path: op.path,
                        message: err.message
                    });
                }
            }
        }
    }

    const success = errors.length === 0;
    if (success) {
        console.log("all checks passed");
    } else {
        console.log("checks failed with " + errors.length + " errors");
    }

    return {
        errors,
        success
    };
};

// routing
const shouldContinue = (state) => {
    if (state.success) {
        console.log("success, done");
        return END;
    }
    
    if (state.iterations >= state.maxIterations) {
        console.log("max iterations hit, stopping");
        return END;
    }

    console.log("errors found, looping back to generate");
    return 'plan_and_generate';
};

// graph build
const workflow = new StateGraph(GraphState)
    .addNode('plan_and_generate', planAndGenerate)
    .addNode('verify_code', verifyCode)
    .addEdge(START, 'plan_and_generate')
    .addEdge('plan_and_generate', 'verify_code')
    .addConditionalEdges('verify_code', shouldContinue);

const app = workflow.compile();

async function executeLangGraphTask(context, task, llmConfig) {
    console.log("starting graph runner...");
    
    const finalState = await app.invoke({
        context,
        task,
        llmConfig,
        maxIterations: 3,
        iterations: 0,
        errors: [],
        operations: [],
        success: false,
        summary: ''
    });

    console.log("graph complete. success: " + finalState.success);

    return {
        success: finalState.success,
        operations: finalState.operations,
        errors: finalState.errors,
        summary: finalState.summary,
        iterations: finalState.iterations
    };
}

module.exports = {
    executeLangGraphTask
};
