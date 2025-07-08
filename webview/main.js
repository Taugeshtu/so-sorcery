import { Resizer } from './ui/resizer.js';
import { MessageHandler } from './core/messaging.js';
import { StateManager } from './core/state.js';
import { ButtonManager } from './ui/buttons.js';
import { FileManager } from './ui/files.js';
import { ItemsManager } from './ui/items.js';
import { SearchManager } from './ui/search.js';
import { WorkerManager } from './ui/workers.js';
import { InputManager } from './ui/input-manager.js';

class SorceryWebview {
    constructor() {
        // Core components
        this.messageHandler = new MessageHandler();
        this.stateManager = new StateManager();
        
        // UI components
        this.resizer = new Resizer();
        this.buttonManager = new ButtonManager(this.messageHandler, this.stateManager);
        this.fileManager = new FileManager(this.messageHandler, this.stateManager);
        this.itemsManager = new ItemsManager(this.messageHandler, this.stateManager);
        this.workerManager = new WorkerManager(this.messageHandler, this.stateManager);
        this.searchManager = new SearchManager(this.fileManager);
        this.inputManager = new InputManager(this.messageHandler, this.stateManager);
        
        this.init();
    }

    init() {
        this.setupMessageHandlers();
        this.setupGlobalEventListeners();
    }

    setupMessageHandlers() {
        this.messageHandler.on('updateState', (message) => {
            this.handleStateUpdate(message.context, message.psycheStates);
            this.inputManager.loadDraftFromContext(message.context);
        });
        
        this.messageHandler.on('updateFiles', (message) => {
            this.handleFilesUpdate(message.availableFiles);
        });
        
        this.messageHandler.on('setAgentRunning', (message) => {
            this.buttonManager.setAgentRunning(message.running);
        });
        
        this.messageHandler.on('executeUndo', () => {
            this.inputManager.undo();
        });
        
        this.messageHandler.on('executeRedo', () => {
            this.inputManager.redo();
        });
    }

    setupGlobalEventListeners() {
        // Any global event listeners that don't belong to specific managers
        // Most event listeners are now handled by individual managers
    }

    handleStateUpdate(context, psycheStates) {
        // Update state manager
        this.stateManager.updateContext(context);
        
        // Update items display
        this.itemsManager.updateItemsList(context.items);
        
        // Update file lists, because we might've touched file knowledge
        this.fileManager.updateFileLists();
        
        // Update worker buttons and outputs
        // TODO: ideally we want psyche's display names here...
        this.workerManager.updateWorkerButtons(context.workerOutputs || {}, psycheStates);
    }
    
    handleFilesUpdate(availableFiles) {
        // Update state manager
        this.stateManager.updateFiles(availableFiles);
        
        // UI update
        this.fileManager.updateFileLists();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SorceryWebview();
});