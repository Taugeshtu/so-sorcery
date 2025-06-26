export class ButtonManager {
    constructor(messageHandler, stateManager) {
        this.messageHandler = messageHandler;
        this.stateManager = stateManager;
        this.init();
        this.setupVSCodeMessageHandling();
    }
    
    init() {
        this.setupEventListeners();
        this.updateButtonText();
    }
    
    setupVSCodeMessageHandling() {
        // Listen for messages from VS Code extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.command) {
                case 'executeAddAndRun':
                    this.handleRunButton();
                    break;
                case 'executeAddKnowledge':
                    this.addKnowledge();
                    break;
            }
        });
    }
    
    setupEventListeners() {
        const userInput = document.getElementById('userInput');
        const addButton = document.getElementById('addButton');
        const runButton = document.getElementById('runButton');

        if (userInput) {
            // Update button text when input changes
            userInput.addEventListener('input', () => {
                this.updateButtonText();
            });
        }

        if (addButton) {
            addButton.addEventListener('click', () => this.addKnowledge());
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
            // add knowledge...
            this.addKnowledge();
        }
        // run the agent:
        this.runAgent();
    }

    addKnowledge() {
        const userInput = document.getElementById('userInput');
        if (!userInput) return;

        const content = userInput.value.trim();
        if (!content) return;

        // Disable buttons while processing
        this.setButtonsEnabled(false);
        
        this.messageHandler.send('addUserKnowledge', { content });

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
