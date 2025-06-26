export class ButtonManager {
    constructor(messageHandler, stateManager) {
        this.messageHandler = messageHandler;
        this.stateManager = stateManager;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateButtonText();
    }

    setupEventListeners() {
        const userInput = document.getElementById('userInput');
        const addButton = document.getElementById('addButton');
        const runButton = document.getElementById('runButton');

        if (userInput) {
            // Handle keyboard shortcuts
            userInput.addEventListener('keydown', (e) => {
                if (e.altKey && e.key === 'Enter') {
                    e.preventDefault();
                    this.addKnowledge(false);
                } else if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    this.handleRunButton();
                }
            });

            // Update button text when input changes
            userInput.addEventListener('input', () => {
                this.updateButtonText();
            });
        }

        if (addButton) {
            addButton.addEventListener('click', () => this.addKnowledge(false));
        }

        if (runButton) {
            runButton.addEventListener('click', () => this.handleRunButton());
        }
    }

    updateButtonText() {
        const userInput = document.getElementById('userInput');
        const runButton = document.getElementById('runButton');
        
        if (!userInput || !runButton) return;

        const hasContent = userInput.value.trim().length > 0;
        runButton.textContent = hasContent ? '+ & Run' : 'Run';
    }

    handleRunButton() {
        const userInput = document.getElementById('userInput');
        if (!userInput) return;

        const hasContent = userInput.value.trim().length > 0;
        
        if (hasContent) {
            // Add knowledge and run agent
            this.addKnowledge(true);
        } else {
            // Just run agent with current context
            this.runAgent();
        }
    }

    addKnowledge(runAgent = false) {
        const userInput = document.getElementById('userInput');
        if (!userInput) return;

        const content = userInput.value.trim();
        if (!content) return;

        // Disable buttons while processing
        this.setButtonsEnabled(false);

        this.messageHandler.send('addUserKnowledge', {
            content: content,
            runAgent: runAgent
        });

        // Clear input
        userInput.value = '';
        this.updateButtonText();
        
        // Re-enable buttons (they'll be disabled again if agent is running)
        setTimeout(() => {
            this.setButtonsEnabled(true);
        }, 100);
    }

    runAgent() {
        this.setButtonsEnabled(false);
        this.messageHandler.send('runAgent');
    }

    setAgentRunning(running) {
        this.setButtonsEnabled(!running);
        
        const runButton = document.getElementById('runButton');
        if (runButton) {
            if (running) {
                runButton.textContent = 'Running...';
            } else {
                this.updateButtonText();
            }
        }
    }

    setButtonsEnabled(enabled) {
        const addButton = document.getElementById('addButton');
        const runButton = document.getElementById('runButton');
        const userInput = document.getElementById('userInput');
        
        if (addButton) addButton.disabled = !enabled;
        if (runButton) runButton.disabled = !enabled;
        if (userInput) userInput.disabled = !enabled;
    }

    // Public method to get current input value
    getCurrentInput() {
        const userInput = document.getElementById('userInput');
        return userInput ? userInput.value.trim() : '';
    }

    // Public method to clear input
    clearInput() {
        const userInput = document.getElementById('userInput');
        if (userInput) {
            userInput.value = '';
            this.updateButtonText();
        }
    }
}
