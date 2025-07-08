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
        // Separate folders and files, then sort each group
        const entries = Object.keys(tree)
            .filter(key => !key.startsWith('_')) // Skip metadata
            .map(key => ({ key, item: tree[key] }));
        
        // Separate into folders and files
        const folders = entries.filter(entry => !entry.item._isFile);
        const files = entries.filter(entry => entry.item._isFile);
        
        // Sort each group alphabetically
        folders.sort((a, b) => a.key.localeCompare(b.key));
        files.sort((a, b) => a.key.localeCompare(b.key));
        
        // Render folders first, then files
        [...folders, ...files].forEach(({ key, item }) => {
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
        const searchInput = document.getElementById('fileSearchInput');
        searchInput.value = '';
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
