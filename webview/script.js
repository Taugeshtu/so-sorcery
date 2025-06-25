// webview/script.js
const vscode = acquireVsCodeApi();

let isResizing = false;
let allAvailableFiles = [];
let fileKnowledges = []; // Store full knowledge objects instead of just paths
let currentContext = null; // Store the full context
let currentWorkerView = null; // Track which worker output is currently shown

document.addEventListener('DOMContentLoaded', () => {
    const resizer = document.getElementById('resizer');
    const sidebar = document.getElementById('sidebar');
    const container = document.getElementById('container');
    const searchInput = document.getElementById('fileSearchInput');
    const userInput = document.getElementById('userInput');
    const addButton = document.getElementById('addButton');
    const runButton = document.getElementById('runButton');
    const copyWorkerOutputButton = document.getElementById('copyWorkerOutputButton');
    
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
            handleRunButton();
        }
    });

    // Update button text when input changes
    userInput.addEventListener('input', updateButtonText);
    
    // Button handlers
    addButton.addEventListener('click', () => addKnowledge(false));
    runButton.addEventListener('click', handleRunButton);
    copyWorkerOutputButton.addEventListener('click', copyWorkerOutput);
    
    // Initialize button text
    updateButtonText();
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
    
    // Filter file knowledges from the unified items array
    fileKnowledges = context.items.filter(item => 
        'source' in item && item.source === 'file'
    );
    
    updateWorkerButtons(context.workerOutputs || {});
    updateItemsList(context.items);
    updateIncludedFilesList();
    updateAvailableFilesTree();
}

function updateWorkerButtons(workerOutputs) {
    const workerButtonsContainer = document.getElementById('workerButtons');
    workerButtonsContainer.innerHTML = '';
    
    const workerNames = Object.keys(workerOutputs);
    
    workerNames.forEach(workerName => {
        const button = document.createElement('button');
        button.className = 'worker-button';
        button.textContent = workerName;
        button.dataset.workerName = workerName;
        
        // Set active state if this worker is currently shown
        if (currentWorkerView === workerName) {
            button.classList.add('active');
        }
        
        button.addEventListener('click', () => {
            if (currentWorkerView === workerName) {
                // Clicking active button - hide worker output
                hideWorkerOutput();
            } else {
                // Show this worker's output
                showWorkerOutput(workerName);
            }
        });
        
        workerButtonsContainer.appendChild(button);
    });
}

function showWorkerOutput(workerName) {
    currentWorkerView = workerName;
    
    // Update button states
    document.querySelectorAll('.worker-button').forEach(btn => {
        if (btn.dataset.workerName === workerName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Hide knowledge list and show worker output
    document.getElementById('knowledgesList').style.display = 'none';
    const workerOutput = document.getElementById('workerOutput');
    workerOutput.classList.remove('hidden');
    
    // Update worker output content
    const workerOutputTitle = document.getElementById('workerOutputTitle');
    const workerOutputContent = document.getElementById('workerOutputContent');
    
    workerOutputTitle.textContent = `${workerName} Output`;
    
    const output = currentContext.workerOutputs[workerName];
    if (output && output.trim()) {
        workerOutputContent.textContent = output;
    } else {
        workerOutputContent.textContent = 'No output yet';
    }
}

function hideWorkerOutput() {
    currentWorkerView = null;
    
    // Update button states - remove all active states
    document.querySelectorAll('.worker-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show knowledge list and hide worker output
    document.getElementById('knowledgesList').style.display = 'block';
    document.getElementById('workerOutput').classList.add('hidden');
}

function copyWorkerOutput() {
    if (!currentWorkerView || !currentContext.workerOutputs) {
        return;
    }
    
    const output = currentContext.workerOutputs[currentWorkerView];
    if (output && output.trim()) {
        copyToClipboard(output);
    }
}

function updateItemsList(items) {
    const knowledgesList = document.getElementById('knowledgesList');
    knowledgesList.innerHTML = '';
    
    if (items.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'No knowledge or work items yet. Add some to get started!';
        knowledgesList.appendChild(emptyState);
        return;
    }

    // Filter out file knowledges for the main list and sort by timestamp
    const displayItems = items
        .filter(item => !('source' in item && item.source === 'file'))
        .sort((a, b) => {
            const aTime = a.metadata?.timestamp || 0;
            const bTime = b.metadata?.timestamp || 0;
            return aTime - bTime;
        });
    
    displayItems.forEach((item, index) => {
        let itemCard;
        if ('source' in item) {
            // It's a knowledge item
            itemCard = createKnowledgeCard(item);
        } else if ('executor' in item) {
            // It's a work item
            itemCard = createWorkItemCard(item);
        }
        
        if (itemCard) {
            knowledgesList.appendChild(itemCard);
            
            // Add arrows if there are references (only for knowledge items)
            if ('references' in item && item.references && item.references.length > 0) {
                const arrowContainer = createArrowContainer(item.references);
                knowledgesList.appendChild(arrowContainer);
            }
            
            // Add spacing between cards
            if (index < displayItems.length - 1) {
                const spacer = document.createElement('div');
                spacer.className = 'knowledge-spacer';
                knowledgesList.appendChild(spacer);
            }
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
    
    const headerRight = document.createElement('div');
    headerRight.className = 'knowledge-header-right';

    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.textContent = 'Copy';
    copyButton.onclick = (e) => {
        e.stopPropagation();
        copyToClipboard(knowledge.content);
    };

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.textContent = '×';
    deleteButton.onclick = (e) => {
        e.stopPropagation();
        removeKnowledge(knowledge.id);
    };

    headerRight.appendChild(copyButton);
    headerRight.appendChild(deleteButton);
    
    header.appendChild(headerLeft);
    header.appendChild(headerRight);
    
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

function createWorkItemCard(workItem) {
    const card = document.createElement('div');
    card.className = `work-item-card ${workItem.type}-work`;
    card.dataset.workItemId = workItem.id;
    
    // Header
    const header = document.createElement('div');
    header.className = 'work-item-header';
    
    const headerLeft = document.createElement('div');
    headerLeft.className = 'work-item-header-left';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'work-item-name';
    nameSpan.textContent = `Work Item #${workItem.id}`;
    
    const typeSpan = document.createElement('span');
    typeSpan.className = 'work-item-type';
    typeSpan.textContent = `[${workItem.executor}]`;
    
    headerLeft.appendChild(nameSpan);
    headerLeft.appendChild(typeSpan);
    
    const headerRight = document.createElement('div');
    headerRight.className = 'work-item-header-right';

    const goButton = document.createElement('button');
    goButton.className = 'go-button';
    goButton.textContent = 'Go';
    goButton.onclick = (e) => {
        e.stopPropagation();
        copyToClipboard(workItem.content);
    };

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.textContent = '×';
    deleteButton.onclick = (e) => {
        e.stopPropagation();
        removeWorkItem(workItem.id);
    };

    headerRight.appendChild(goButton);
    headerRight.appendChild(deleteButton);
    
    header.appendChild(headerLeft);
    header.appendChild(headerRight);
    
    // Content
    const content = document.createElement('div');
    content.className = 'work-item-content';
    content.textContent = workItem.content;
    
    card.appendChild(header);
    card.appendChild(content);
    
    return card;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        vscode.postMessage({
            command: 'showInformationMessage',
            text: 'Content copied to clipboard'
        });
    }, (err) => {
        console.error('Could not copy text: ', err);
    });
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
        command: 'toggleItemCollapse',
        id: id
    });
}

function updateButtonText() {
    const userInput = document.getElementById('userInput');
    const runButton = document.getElementById('runButton');
    const hasContent = userInput.value.trim().length > 0;
    
    runButton.textContent = hasContent ? '+ & Run' : 'Run';
}

// Add this new function:
function handleRunButton() {
    const userInput = document.getElementById('userInput');
    const hasContent = userInput.value.trim().length > 0;
    
    if (hasContent) {
        // Add knowledge and run agent
        addKnowledge(true);
    } else {
        // Just run agent with current context
        runAgent();
    }
}

function runAgent() {
    const runButton = document.getElementById('runButton');
    runButton.disabled = true;
    
    vscode.postMessage({
        command: 'runAgent'
    });
}

function setAgentRunning(running) {
    const addButton = document.getElementById('addButton');
    const runButton = document.getElementById('runButton');
    const userInput = document.getElementById('userInput');
    
    addButton.disabled = running;
    runButton.disabled = running;
    userInput.disabled = running;
    
    if (running) {
        runButton.textContent = 'Running...';
    } else {
        updateButtonText(); // Use the new function to set correct text
    }
}

function updateIncludedFilesList() {
    const includedFilesList = document.getElementById('includedFilesList');
    includedFilesList.innerHTML = '';
    
    if (fileKnowledges.length > 0) {
        fileKnowledges.forEach(knowledge => {
            const li = document.createElement('li');
            li.className = 'included-file-item';
            li.textContent = getFileName(knowledge.content);
            li.title = knowledge.content;
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
    
    const includedFilePaths = fileKnowledges.map(k => k.content).filter(Boolean);
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
    const runButton = document.getElementById('runButton');
    addButton.disabled = true;
    runButton.disabled = true;

    vscode.postMessage({
        command: 'addUserKnowledge',
        content: content,
        runAgent: runAgent
    });

    // Clear input
    userInput.value = '';
    updateButtonText(); // Update button text after clearing input
    
    // Re-enable buttons (they'll be disabled again if agent is running)
    setTimeout(() => {
        addButton.disabled = false;
        runButton.disabled = false;
    }, 100);
}

function removeKnowledge(id) {
    console.log('Removing item:', id);
    vscode.postMessage({
        command: 'removeItem', // Changed from 'removeKnowledge'
        id: id
    });
}

function removeWorkItem(id) {
    console.log('Removing item:', id);
    vscode.postMessage({
        command: 'removeItem', // Changed from 'removeWorkItem'
        id: id
    });
}

function getFileName(filePath) {
    return filePath.split('/').pop() || filePath;
}
