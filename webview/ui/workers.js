export class WorkerManager {
    constructor(messageHandler, stateManager) {
        this.messageHandler = messageHandler;
        this.stateManager = stateManager;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const copyWorkerOutputButton = document.getElementById('copyWorkerOutputButton');
        if (copyWorkerOutputButton) {
            copyWorkerOutputButton.addEventListener('click', this.copyWorkerOutput.bind(this));
        }
    }
    
    updateWorkerButtons(workerOutputs, psycheStates = []) {
        const workerButtonsContainer = document.getElementById('workerButtons');
        if (!workerButtonsContainer) return;

        workerButtonsContainer.innerHTML = '';
        const workerNames = Object.keys(workerOutputs || {});
        
        const executionStates = {};
        if (Array.isArray(psycheStates)) {
            psycheStates.forEach(([name, displayName, isExecuting]) => {
                executionStates[name] = {displayName, isExecuting};
            });
        }
        
        workerNames.forEach(workerName => {
            const button = document.createElement('button');
            button.className = 'worker-button';
            button.textContent = executionStates[workerName].displayName;
            button.dataset.workerName = workerName;
            
            const isBusy = executionStates[workerName].isExecuting || false;
            if (isBusy) {
                button.classList.add('busy');
            }
            
            // Set active state if this worker is currently shown
            if (this.stateManager.currentWorkerView === workerName) {
                button.classList.add('active');
            }
            
            button.addEventListener('click', () => {
                if (this.stateManager.currentWorkerView === workerName) {
                    this.hideWorkerOutput();
                } else {
                    this.showWorkerOutput(workerName);
                }
            });
            
            workerButtonsContainer.appendChild(button);
        });
    }
    
    showWorkerOutput(workerName) {
        this.stateManager.setCurrentWorkerView(workerName);
        
        // Update button states
        document.querySelectorAll('.worker-button').forEach(btn => {
            if (btn.dataset.workerName === workerName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Hide knowledge list and show worker output
        const knowledgesList = document.getElementById('knowledgesList');
        const workerOutput = document.getElementById('workerOutput');
        
        if (knowledgesList) knowledgesList.style.display = 'none';
        if (workerOutput) workerOutput.classList.remove('hidden');
        
        // Update worker output content
        this.updateWorkerOutputContent(workerName);
    }

    hideWorkerOutput() {
        this.stateManager.setCurrentWorkerView(null);
        
        // Update button states - remove all active states
        document.querySelectorAll('.worker-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show knowledge list and hide worker output
        const knowledgesList = document.getElementById('knowledgesList');
        const workerOutput = document.getElementById('workerOutput');
        
        if (knowledgesList) knowledgesList.style.display = 'block';
        if (workerOutput) workerOutput.classList.add('hidden');
    }

    updateWorkerOutputContent(workerName) {
        const workerOutputTitle = document.getElementById('workerOutputTitle');
        const workerOutputContent = document.getElementById('workerOutputContent');
        
        if (!workerOutputTitle || !workerOutputContent) return;

        workerOutputTitle.textContent = `${workerName} Output`;
        
        const output = this.stateManager.currentContext?.workerOutputs?.[workerName];
        if (output && output.trim()) {
            workerOutputContent.textContent = output;
        } else {
            workerOutputContent.textContent = 'No output yet';
        }
    }

    copyWorkerOutput() {
        const output = this.stateManager.getCurrentWorkerOutput();
        if (output && output.trim()) {
            navigator.clipboard.writeText(output).then(() => {
                this.messageHandler.showInfo('Worker output copied to clipboard');
            }, (err) => {
                console.error('Could not copy text: ', err);
            });
        }
    }
}
