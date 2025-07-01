export class FileManager {
    constructor(messageHandler, stateManager) {
        this.messageHandler = messageHandler;
        this.stateManager = stateManager;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const searchInput = document.getElementById('fileSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterAvailableFiles(e.target.value);
            });
        }
        
        const refreshButton = document.getElementById('refreshFilesButton');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                this.refreshFiles();
            });
        }
    }

    refreshFiles() {
        this.messageHandler.send('refreshFiles');
    }

    updateIncludedFilesList() {
        const includedFilesList = document.getElementById('includedFilesList');
        if (!includedFilesList) return;

        includedFilesList.innerHTML = '';
        const fileKnowledges = this.stateManager.fileKnowledges;
        
        if (fileKnowledges.length > 0) {
            fileKnowledges.forEach(knowledge => {
                const li = document.createElement('li');
                li.className = 'included-file-item';
                li.textContent = this.getFileName(knowledge.sourceName);
                li.title = knowledge.sourceName;
                li.onclick = () => this.removeFile(knowledge.id);
                includedFilesList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No files included';
            li.className = 'empty-state';
            includedFilesList.appendChild(li);
        }
    }

    updateAvailableFilesTree(searchTerm = '') {
        const availableFilesTree = document.getElementById('availableFilesTree');
        if (!availableFilesTree) return;

        availableFilesTree.innerHTML = '';
        const availableFiles = this.stateManager.getAvailableFiles();
        
        // Apply search filter
        const filteredFiles = searchTerm 
            ? availableFiles.filter(filePath => 
                filePath.toLowerCase().includes(searchTerm.toLowerCase()))
            : availableFiles;
        
        if (filteredFiles.length > 0) {
            const tree = this.buildFileTree(filteredFiles);
            this.renderFileTree(tree, availableFilesTree);
        } else {
            const div = document.createElement('div');
            div.textContent = searchTerm ? 'No matching files' : 'No available files';
            div.className = 'empty-state';
            availableFilesTree.appendChild(div);
        }
    }

    buildFileTree(filePaths) {
        const tree = {};
        
        filePaths.forEach(filePath => {
            const parts = filePath.split('/');
            let current = tree;
            
            parts.forEach((part, index) => {
                if (index === parts.length - 1) {
                    // It's a file
                    current[part] = { _isFile: true, _fullPath: filePath };
                } else {
                    // It's a directory
                    if (!current[part]) {
                        current[part] = { _isFile: false };
                    }
                    current = current[part];
                }
            });
        });
        
        return tree;
    }

    renderFileTree(tree, container, depth = 0) {
        Object.keys(tree).sort().forEach(key => {
            if (key.startsWith('_')) return; // Skip metadata
            
            const item = tree[key];
            const div = document.createElement('div');
            div.className = item._isFile ? 'file-item' : 'folder-item';
            div.style.paddingLeft = (depth * 20) + 'px';
            
            if (item._isFile) {
                div.textContent = key;
                div.title = item._fullPath;
                div.onclick = () => this.addFileToContext(item._fullPath);
            } else {
                div.textContent = `[${key}]`;
                div.className += ' folder';
            }
            
            container.appendChild(div);
            
            if (!item._isFile) {
                this.renderFileTree(item, container, depth + 1);
            }
        });
    }

    filterAvailableFiles(searchTerm) {
        this.updateAvailableFilesTree(searchTerm);
    }

    addFileToContext(filePath) {
        this.messageHandler.send('addFileToContext', { filePath });
    }

    removeFile(id) {
        this.messageHandler.send('removeItem', { id });
    }

    getFileName(filePath) {
        return filePath.split('/').pop() || filePath;
    }

    // Public method to update both file lists
    updateFileLists() {
        this.updateIncludedFilesList();
        this.updateAvailableFilesTree();
    }
}
