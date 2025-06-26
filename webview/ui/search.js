export class SearchManager {
    constructor(fileManager) {
        this.fileManager = fileManager;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const searchInput = document.getElementById('fileSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });

            // Optional: Add keyboard shortcuts for search
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.clearSearch();
                } else if (e.key === 'Enter') {
                    this.handleEnterKey();
                }
            });
        }
    }

    handleSearch(searchTerm) {
        // Delegate to file manager for filtering
        this.fileManager.filterAvailableFiles(searchTerm);
    }

    clearSearch() {
        const searchInput = document.getElementById('fileSearchInput');
        if (searchInput) {
            searchInput.value = '';
            this.handleSearch('');
        }
    }

    handleEnterKey() {
        // Could implement "select first result" functionality
        // For now, just maintain current behavior
    }

    // Public method to programmatically set search term
    setSearchTerm(term) {
        const searchInput = document.getElementById('fileSearchInput');
        if (searchInput) {
            searchInput.value = term;
            this.handleSearch(term);
        }
    }

    // Public method to get current search term
    getCurrentSearchTerm() {
        const searchInput = document.getElementById('fileSearchInput');
        return searchInput ? searchInput.value : '';
    }
}
