export class Resizer {
    constructor() {
        this.isResizing = false;
        this.init();
    }

    init() {
        const resizer = document.getElementById('resizer');
        if (!resizer) return;

        resizer.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    handleMouseDown(e) {
        this.isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    }

    handleMouseMove(e) {
        if (!this.isResizing) return;
        
        const container = document.getElementById('container');
        const sidebar = document.getElementById('sidebar');
        
        if (!container || !sidebar) return;

        const containerRect = container.getBoundingClientRect();
        const newSidebarWidth = containerRect.right - e.clientX;
        const minWidth = 200;
        const maxWidth = Math.min(600, containerRect.width * 0.7);
        const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newSidebarWidth));
        
        sidebar.style.width = constrainedWidth + 'px';
    }

    handleMouseUp() {
        if (this.isResizing) {
            this.isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    }
}
