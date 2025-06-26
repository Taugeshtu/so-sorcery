export class StateManager {
    constructor() {
        this.currentContext = null;
        this.allAvailableFiles = [];
        this.fileKnowledges = [];
        this.currentWorkerView = null;
    }

    updateContext(context) {
        this.currentContext = context;
        this.fileKnowledges = this.currentContext.items.filter(item => 
            'source' in item && item.source === 'file'
        );
    }
    
    updateFiles(availableFiles) {
        this.allAvailableFiles = availableFiles;
    }

    getIncludedFilePaths() {
        return this.fileKnowledges.map(k => k.content).filter(Boolean);
    }

    getAvailableFiles() {
        const includedPaths = this.getIncludedFilePaths();
        return this.allAvailableFiles.filter(path => !includedPaths.includes(path));
    }

    setCurrentWorkerView(workerName) {
        this.currentWorkerView = workerName;
    }

    getCurrentWorkerOutput() {
        if (!this.currentWorkerView || !this.currentContext?.workerOutputs) {
            return null;
        }
        return this.currentContext.workerOutputs[this.currentWorkerView];
    }
}