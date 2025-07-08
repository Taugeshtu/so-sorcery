export class InputUndoManager {
  constructor() {
    this.history = [''];
    this.currentIndex = 0;
    this.maxHistory = 50;
    this.lastSavedState = '';
  }
  
  pushState(text) {
    // Don't push if text hasn't changed
    if (this.history[this.currentIndex] === text) return;
    
    // Remove any future history if we're not at the end
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push(text);
    
    // Maintain max history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }
  
  undo() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex];
    }
    return null;
  }
  
  redo() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex];
    }
    return null;
  }
  
  getCurrentState() {
    return this.history[this.currentIndex];
  }
  
  // Initialize with draft from session
  initializeWithDraft(draft) {
    this.history = [draft || ''];
    this.currentIndex = 0;
    this.lastSavedState = draft || '';
  }
}