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
    const userInput = document.getElementById('userInput');
    const addButton = document.getElementById('addButton');
    const addRunButton = document.getElementById('addRunButton');
    
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
    
    // Handle keyboard shortcuts
    userInput.addEventListener('keydown', (e) => {
        if (e.altKey && e.key === 'Enter') {
            e.preventDefault();
            addKnowledge(false);
        } else if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            addKnowledge(true);
        }
    });

    // Button handlers
    addButton.addEventListener('click', () => addKnowledge(false));
    addRunButton.addEventListener('click', () => addKnowledge(true));
});

window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
        case 'updateState':
            updateUI(message.context);
            break;
        case 'setAgentRunning':
            setAgentRunning(message.running);
            break;
    }
});

function updateUI(context) {
    currentContext = context;
    allAvailableFiles = context.availableFiles || [];
    fileKnowledges = context.knowledges.filter(k => k.source === 'file');
    
    updateKnowledgesList(context.knowledges);
    updateIncludedFilesList();
    updateAvailableFilesTree();
}

function updateKnowledgesList(knowledges) {
    const knowledgesList = document.getElementById('knowledgesList');
    knowledgesList.innerHTML = '';
    
    if (knowledges.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'No knowledge yet. Add some to get started!';
        knowledgesList.appendChild(emptyState);
        return;
    }

    // Filter out file knowledges for the main list
    const nonFileKnowledges = knowledges.filter(k => k.source !== 'file');
    
    nonFileKnowledges.forEach((knowledge, index) => {
        const knowledgeCard = createKnowledgeCard(knowledge);
        knowledgesList.appendChild(knowledgeCard);
        
        // Add arrows if there are references
        if (knowledge.references && knowledge.references.length > 0) {
            const arrowContainer = createArrowContainer(knowledge.references);
            knowledgesList.appendChild(arrowContainer);
        }
        
        // Add spacing between cards
        if (index < nonFileKnowledges.length - 1) {
            const spacer = document.createElement('div');
            spacer.className = 'knowledge-spacer';
            knowledgesList.appendChild(spacer);
        }
    });
}

function createKnowledgeCard(knowledge) {
    const card = document.createElement('div');
    card.className = `knowledge-card ${knowledge.source}-knowledge ${knowledge.collapsed ? 'collapsed' : 'expanded'}`;
    card.dataset.knowledgeId = knowledge.id;
    
    // Header
    const header = document.createElement('div');
    header.className = 'knowledge-header';
    header.onclick = () => toggleKnowledge(knowledge.id);
    
    const headerLeft = document.createElement('div');
    headerLeft.className = 'knowledge-header-left';
    
    const collapseIndicator = document.createElement('span');
    collapseIndicator.className = 'collapse-indicator';
    collapseIndicator.textContent = knowledge.collapsed ? '▶' : '▼';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'knowledge-name';
    nameSpan.textContent = knowledge.name;
    
    const sourceSpan = document.createElement('span');
    sourceSpan.className = 'knowledge-source';
    sourceSpan.textContent = `[${knowledge.source}]`;
    
    headerLeft.appendChild(collapseIndicator);
    headerLeft.appendChild(nameSpan);
    headerLeft.appendChild(sourceSpan);
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.textContent = '×';
    deleteButton.onclick = (e) => {
        e.stopPropagation();
        removeKnowledge(knowledge.id);
    };
    
    header.appendChild(headerLeft);
    header.appendChild(deleteButton);
    
    // Content
    const content = document.createElement('div');
    content.className = 'knowledge-content';
    
    if (knowledge.collapsed) {
        // Show truncated content (8 lines max)
        const lines = knowledge.content.split('\n');
        const truncatedContent = lines.slice(0, 8).join('\n');
        content.textContent = truncatedContent + (lines.length > 8 ? '\n...' : '');
    } else {
        content.textContent = knowledge.content;
    }
    
    card.appendChild(header);
    card.appendChild(content);
    
    return card;
}

function createArrowContainer(referenceIds) {
    const container = document.createElement('div');
    container.className = 'arrow-container';
    
    referenceIds.forEach(refId => {
        const arrow = document.createElement('div');
        arrow.className = 'reference-arrow';
        arrow.innerHTML = '↗'; // You can style this better with CSS
        arrow.title = `References knowledge #${refId}`;
        container.appendChild(arrow);
    });
    
    return container;
}

function toggleKnowledge(id) {
    vscode.postMessage({
        command: 'toggleKnowledgeCollapse',
        id: id
    });
}

function setAgentRunning(running) {
    const addButton = document.getElementById('addButton');
    const addRunButton = document.getElementById('addRunButton');
    const userInput = document.getElementById('userInput');
    
    addButton.disabled = running;
    addRunButton.disabled = running;
    userInput.disabled = running;
    
    if (running) {
        addRunButton.textContent = 'Running...';
    } else {
        addRunButton.textContent = 'Add & Run Agent';
    }
}

function updateIncludedFilesList() {
    const includedFilesList = document.getElementById('includedFilesList');
    includedFilesList.innerHTML = '';
    
    if (fileKnowledges.length > 0) {
        fileKnowledges.forEach(knowledge => {
            const li = document.createElement('li');
            li.className = 'included-file-item';
            li.textContent = getFileName(knowledge.metadata?.filePath || 'Unknown file');
            li.title = knowledge.metadata?.filePath || 'Unknown file';
            li.onclick = () => removeKnowledge(knowledge.id);
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

function addKnowledge(runAgent = false) {
    const userInput = document.getElementById('userInput');
    const content = userInput.value.trim();
    
    if (!content) {
        return;
    }

    // Disable buttons while processing
    const addButton = document.getElementById('addButton');
    const addRunButton = document.getElementById('addRunButton');
    addButton.disabled = true;
    addRunButton.disabled = true;

    vscode.postMessage({
        command: 'addUserKnowledge',
        content: content,
        runAgent: runAgent
    });

    // Clear input
    userInput.value = '';
    
    // Re-enable buttons (they'll be disabled again if agent is running)
    setTimeout(() => {
        addButton.disabled = false;
        addRunButton.disabled = false;
    }, 100);
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