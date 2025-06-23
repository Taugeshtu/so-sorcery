// webview/script.js
const vscode = acquireVsCodeApi();

let isResizing = false;
let allAvailableFiles = [];
let fileKnowledges = []; // Store full knowledge objects instead of just paths
let currentContext = null; // Store the full context

document.addEventListener('DOMContentLoaded', () => {
    const resizer = document.getElementById('resizer');
    const sidebar = document.getElementById('sidebar');
    const container = document.getElementById('container');
    const searchInput = document.getElementById('fileSearchInput');

    // Resizer logic (unchanged)
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const containerRect = container.getBoundingClientRect();
        const newSidebarWidth = containerRect.right - e.clientX;
        const minWidth = 200;
        const maxWidth = Math.min(600, containerRect.width * 0.7);
        const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newSidebarWidth));
        sidebar.style.width = constrainedWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        filterAvailableFiles(e.target.value);
    });
});

window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
        case 'updateState':
            updateUI(message.context);
            break;
    }
});

function updateUI(context) {
    currentContext = context; // Store for use in other functions
    allAvailableFiles = context.availableFiles || [];
    fileKnowledges = context.knowledges.filter(k => k.source === 'file');
    
    updateIncludedFilesList();
    updateAvailableFilesTree();
}

function updateIncludedFilesList() {
    const includedFilesList = document.getElementById('includedFilesList');
    includedFilesList.innerHTML = '';
    
    if (fileKnowledges.length > 0) {
        fileKnowledges.forEach(knowledge => {
            const li = document.createElement('li');
            li.className = 'included-file-item';
            li.textContent = getFileName(knowledge.metadata?.filePath);
            li.title = knowledge.metadata?.filePath;
            li.onclick = () => removeKnowledge(knowledge.id); // Now we have the ID!
            includedFilesList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'No files included';
        li.className = 'empty-state';
        includedFilesList.appendChild(li);
    }
}

function updateAvailableFilesTree(searchTerm = '') {
    const availableFilesTree = document.getElementById('availableFilesTree');
    availableFilesTree.innerHTML = '';
    
    const includedFilePaths = fileKnowledges.map(k => k.metadata?.filePath).filter(Boolean);
    const availableFiles = allAvailableFiles.filter(filePath => !includedFilePaths.includes(filePath));
    
    // Apply search filter
    const filteredFiles = searchTerm 
        ? availableFiles.filter(filePath => 
            filePath.toLowerCase().includes(searchTerm.toLowerCase()))
        : availableFiles;
    
    if (filteredFiles.length > 0) {
        // Build tree structure
        const tree = buildFileTree(filteredFiles);
        renderFileTree(tree, availableFilesTree);
    } else {
        const div = document.createElement('div');
        div.textContent = searchTerm ? 'No matching files' : 'No available files';
        div.className = 'empty-state';
        availableFilesTree.appendChild(div);
    }
}

function buildFileTree(filePaths) {
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

function renderFileTree(tree, container, depth = 0) {
    Object.keys(tree).sort().forEach(key => {
        if (key.startsWith('_')) return; // Skip metadata
        
        const item = tree[key];
        const div = document.createElement('div');
        div.className = item._isFile ? 'file-item' : 'folder-item';
        div.style.paddingLeft = (depth * 20) + 'px';
        
        if (item._isFile) {
            div.textContent = key;
            div.title = item._fullPath;
            div.onclick = () => addFileToContext(item._fullPath);
        } else {
            div.textContent = `[${key}]`;
            div.className += ' folder';
        }
        
        container.appendChild(div);
        
        if (!item._isFile) {
            renderFileTree(item, container, depth + 1);
        }
    });
}

function filterAvailableFiles(searchTerm) {
    updateAvailableFilesTree(searchTerm);
}

function addFileToContext(filePath) {
    vscode.postMessage({
        command: 'addFileToContext',
        filePath: filePath
    });
}

function removeKnowledge(id) {
    console.log('Removing knowledge:', id);
    vscode.postMessage({
        command: 'removeKnowledge',
        id: id
    });
}

function getFileName(filePath) {
    return filePath.split('/').pop() || filePath;
}