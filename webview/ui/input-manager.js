import { InputUndoManager } from './input-undo-manager.js';

export class InputManager {
  constructor(messageHandler, stateManager) {
    this.messageHandler = messageHandler;
    this.stateManager = stateManager;
    this.undoManager = new InputUndoManager();
    this.draftSaveTimer = null;
    this.lastPushTime = 0;
    this.pushDelay = 500; // Push to history after 500ms of no typing
    this.initialized = false;
    this.init();
  }
  
  init() {
    const inputField = document.getElementById('userInput');
    if (!inputField) return;
    
    // Setup event listeners
    inputField.addEventListener('input', this.handleInput.bind(this));
    inputField.addEventListener('keydown', this.handleKeydown.bind(this));
    
    // Focus management
    inputField.addEventListener('focus', () => {
      this.inputHasFocus = true;
    });
    inputField.addEventListener('blur', () => {
      this.inputHasFocus = false;
    });
  }
  
  handleInput(event) {
    const text = event.target.value;
    
    // Schedule history push (debounced)
    clearTimeout(this.historyPushTimer);
    this.historyPushTimer = setTimeout(() => {
      this.undoManager.pushState(text);
    }, this.pushDelay);
    
    // Schedule draft save (also debounced)
    this.scheduleDraftSave();
  }
  
  handleKeydown(event) {
    // Only handle undo/redo when input field has focus
    if (!this.inputHasFocus) return;
    
    const checkpointKeys = ['Enter', ' ', '.'];
    if (checkpointKeys.includes(event.key)) {
      // Push current state to undo history before the edit happens
      const inputField = document.getElementById('userInput');
      this.undoManager.pushState(inputField.value);
    }
  }
  
  undo() {
    const previousState = this.undoManager.undo();
    if (previousState !== null) {
      const inputField = document.getElementById('userInput');
      inputField.value = previousState;
      this.scheduleDraftSave();
    }
  }
  
  redo() {
    const nextState = this.undoManager.redo();
    if (nextState !== null) {
      const inputField = document.getElementById('userInput');
      inputField.value = nextState;
      this.scheduleDraftSave();
    }
  }
  
  scheduleDraftSave() {
    clearTimeout(this.draftSaveTimer);
    this.draftSaveTimer = setTimeout(() => {
      this.saveDraft();
    }, 1000);
  }
  
  saveDraft() {
    const inputField = document.getElementById('userInput');
    const currentDraft = inputField.value;
    
    // Only save if draft has changed
    if (currentDraft !== this.undoManager.lastSavedState) {
      this.messageHandler.send('updateDraft', { draft: currentDraft });
      this.undoManager.lastSavedState = currentDraft;
    }
  }
  
  loadDraftFromContext(context) {
    if(this.initialized === true) return;
    
    if (context?.inputDraft !== undefined) {
        const inputField = document.getElementById('userInput');
        if (inputField && inputField.value !== context.inputDraft) {
            inputField.value = context.inputDraft;
            this.undoManager.initializeWithDraft(context.inputDraft);
            this.initialized = true;
        }
    }
  }
}