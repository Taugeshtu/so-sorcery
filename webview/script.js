// webview/script.js
const vscode = acquireVsCodeApi();

// Resizer functionality
let isResizing = false;

document.addEventListener('DOMContentLoaded', () => {
    const resizer = document.getElementById('resizer');
    const sidebar = document.getElementById('sidebar');
    const container = document.getElementById('container');

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        
        // Prevent text selection during resize
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const containerRect = container.getBoundingClientRect();
        const newSidebarWidth = containerRect.right - e.clientX;
        
        // Enforce min/max constraints
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
});

// Add message listener to see what we're receiving
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
        case 'updateState':
            updateUI(message.context);
            break;
    }
});

function updateUI(context) {
    // Update files list
    const filesList = document.getElementById('filesList');
    filesList.innerHTML = '';
    
    if (context.availableFiles && context.availableFiles.length > 0) {
        console.log(`Rendering ${context.availableFiles.length} files`);
        context.availableFiles.forEach(filePath => {
            const li = document.createElement('li');
            li.textContent = filePath;
            li.onclick = () => addFileToContext(filePath);
            filesList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'No files found';
        li.style.fontStyle = 'italic';
        filesList.appendChild(li);
    }
    
    // Update context files list
    updateContextFilesList(context.knowledges);
}

function updateContextFilesList(knowledges) {
    const contextFilesList = document.getElementById('contextFilesList');
    contextFilesList.innerHTML = '';
    
    const fileKnowledges = knowledges.filter(k => k.source === 'file');
    
    if (fileKnowledges.length > 0) {
        fileKnowledges.forEach(knowledge => {
            const li = document.createElement('li');
            li.textContent = knowledge.metadata?.filePath || knowledge.content;
            li.onclick = () => removeKnowledge(knowledge.id);
            contextFilesList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'No files in context';
        li.style.fontStyle = 'italic';
        contextFilesList.appendChild(li);
    }
}

function addFileToContext(filePath) {
    console.log('Adding file to context:', filePath);
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

function toggleSection(sectionId) {
  const content = document.getElementById(sectionId + '-content');
  const arrow = document.getElementById(sectionId + '-arrow');
  
  if (content.classList.contains('collapsed')) {
    content.classList.remove('collapsed');
    arrow.classList.remove('collapsed');
    content.style.maxHeight = content.scrollHeight + 'px';
  } else {
    content.classList.add('collapsed');
    arrow.classList.add('collapsed');
    content.style.maxHeight = '0';
  }
}