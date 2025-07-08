export class ItemsManager {
    constructor(messageHandler, stateManager) {
        this.messageHandler = messageHandler;
        this.stateManager = stateManager;
        this.init();
    }

    init() {
        // Items manager doesn't need specific event listeners at init
        // All interactions are handled through dynamically created elements
    }
    
    updateItemsList(items, psycheStates = []) {
        // Store psycheStates for use in categorizeExecutor
        this.psycheStates = psycheStates;
        
        const knowledgesList = document.getElementById('knowledgesList');
        if (!knowledgesList) return;
        
        knowledgesList.innerHTML = '';
        
        const displayItems = items
            .filter(item => !(item.sourceType === 'file'))
            .sort((a, b) => {
                const aTime = a.metadata?.timestamp || 0;
                const bTime = b.metadata?.timestamp || 0;
                return aTime - bTime;
            });
        
        if (displayItems.length === 0) {
            this.renderEmptyState(knowledgesList);
            return;
        }
        
        displayItems.forEach((item, index) => {
            let itemCard;
            if (item.type === 'knowledge') {
                itemCard = this.createKnowledgeCard(item);
            } else if (item.type === 'work') {
                itemCard = this.createWorkItemCard(item);
            }
            
            if (itemCard) {
                knowledgesList.appendChild(itemCard);
                
                // Add arrows if there are references (only for knowledge items)
                if ('references' in item && item.references && item.references.length > 0) {
                    const arrowContainer = this.createArrowContainer(item.references);
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

    renderEmptyState(container) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'Add some project knowledge to get started!';
        container.appendChild(emptyState);
    }

    createKnowledgeCard(knowledge) {
        const card = document.createElement('div');
        card.className = `knowledge-card ${knowledge.sourceType}-knowledge ${knowledge.metadata.collapsed ? 'collapsed' : 'expanded'}`;
        card.dataset.knowledgeId = knowledge.id;
        
        // Header
        const header = this.createKnowledgeHeader(knowledge);
        
        // Content
        const content = this.createKnowledgeContent(knowledge);
        
        card.appendChild(header);
        card.appendChild(content);
        
        return card;
    }

    createKnowledgeHeader(knowledge) {
        const header = document.createElement('div');
        header.className = 'knowledge-header';
        header.onclick = () => this.toggleKnowledge(knowledge.id);
        
        const headerLeft = document.createElement('div');
        headerLeft.className = 'knowledge-header-left';
        
        const collapseIndicator = document.createElement('span');
        collapseIndicator.className = 'collapse-indicator';
        collapseIndicator.textContent = knowledge.metadata.collapsed ? '▶' : '▼';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'knowledge-name';
        nameSpan.textContent = `[${knowledge.id}] knowledge`;
        
        const sourceSpan = document.createElement('span');
        sourceSpan.className = 'knowledge-source';
        sourceSpan.textContent = `[${knowledge.sourceName}]`;
        
        headerLeft.appendChild(collapseIndicator);
        headerLeft.appendChild(nameSpan);
        headerLeft.appendChild(sourceSpan);
        
        const headerRight = this.createKnowledgeHeaderButtons(knowledge);
        
        header.appendChild(headerLeft);
        header.appendChild(headerRight);
        
        return header;
    }

    createKnowledgeHeaderButtons(knowledge) {
        const headerRight = document.createElement('div');
        headerRight.className = 'knowledge-header-right';

        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.textContent = 'Copy';
        copyButton.onclick = (e) => {
            e.stopPropagation();
            this.copyToClipboard(knowledge.content);
        };

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = '×';
        deleteButton.onclick = (e) => {
            e.stopPropagation();
            this.removeItem(knowledge.id);
        };

        headerRight.appendChild(copyButton);
        headerRight.appendChild(deleteButton);
        
        return headerRight;
    }

    createKnowledgeContent(knowledge) {
        const content = document.createElement('div');
        content.className = 'knowledge-content';
        
        if (knowledge.metadata.collapsed) {
            // Show truncated content (8 lines max)
            const lines = knowledge.content.split('\n');
            const truncatedContent = lines.slice(0, 8).join('\n');
            content.textContent = truncatedContent + (lines.length > 8 ? '\n...' : '');
        } else {
            content.textContent = knowledge.content;
        }
        
        return content;
    }

    createWorkItemCard(workItem) {
        const card = document.createElement('div');
        
        // Add status and executor type classes
        const executorType = this.categorizeExecutor(workItem.executor, this.stateManager);
        card.className = `work-item-card ${workItem.type}-work status-${workItem.status} executor-${executorType}`;
        card.dataset.workItemId = workItem.id;
        
        // Header
        const header = this.createWorkItemHeader(workItem);
        
        // Content
        const content = this.createWorkItemContent(workItem);
        
        card.appendChild(header);
        card.appendChild(content);
        
        return card;
    }

    createWorkItemHeader(workItem) {
        const header = document.createElement('div');
        header.className = 'work-item-header';
        
        const headerLeft = document.createElement('div');
        headerLeft.className = 'work-item-header-left';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'work-item-name';
        nameSpan.textContent = `[${workItem.id}] work`;
        
        const typeSpan = document.createElement('span');
        typeSpan.className = 'work-item-type';
        typeSpan.textContent = `[${workItem.executor}]`;
        
        headerLeft.appendChild(nameSpan);
        headerLeft.appendChild(typeSpan);
        
        const headerRight = this.createWorkItemHeaderButtons(workItem);
        
        header.appendChild(headerLeft);
        header.appendChild(headerRight);
        
        return header;
    }

    createWorkItemHeaderButtons(workItem) {
        const headerRight = document.createElement('div');
        headerRight.className = 'work-item-header-right';

        const goButton = document.createElement('button');
        goButton.className = 'go-button';
        goButton.textContent = 'Go';
        goButton.onclick = (e) => {
            e.stopPropagation();
            this.messageHandler.send('executeWorkItem', { id: workItem.id });
        };

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = '×';
        deleteButton.onclick = (e) => {
            e.stopPropagation();
            this.removeItem(workItem.id);
        };

        headerRight.appendChild(goButton);
        headerRight.appendChild(deleteButton);
        
        return headerRight;
    }

    createWorkItemContent(workItem) {
        const content = document.createElement('div');
        content.className = 'work-item-content';
        content.textContent = workItem.content;
        
        return content;
    }

    createArrowContainer(referenceIds) {
        const container = document.createElement('div');
        container.className = 'arrow-container';
        
        referenceIds.forEach(refId => {
            const arrow = document.createElement('div');
            arrow.className = 'reference-arrow';
            arrow.innerHTML = '↗';
            arrow.title = `References knowledge #${refId}`;
            container.appendChild(arrow);
        });
        
        return container;
    }
    
    categorizeExecutor(executor, stateManager) {
        // Check if executor is "user"
        if (executor === 'user') {
            return 'user';
        }
        
        // Check if executor matches any known psyche from the dynamic list
        if (this.psycheStates && Array.isArray(this.psycheStates)) {
            const knownAgents = this.psycheStates.map(([name, displayName, isExecuting]) => name);
            if (knownAgents.includes(executor)) {
                return 'agent';
            }
        }
        
        // Default to tool for anything else
        return 'tool';
    }

    toggleKnowledge(id) {
        this.messageHandler.send('toggleItemCollapse', { id });
    }

    removeItem(id) {
        console.log('Removing item:', id);
        this.messageHandler.send('removeItem', { id });
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.messageHandler.showInfo('Content copied to clipboard');
        }, (err) => {
            console.error('Could not copy text: ', err);
        });
    }

    // Public method to refresh the items display
    refresh() {
        if (this.stateManager.currentContext?.items) {
            this.updateItemsList(this.stateManager.currentContext.items);
        }
    }
}
