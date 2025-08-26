/**
 * Arabic To-Do App - Main Application Logic
 * Mobile-first, RTL-supporting task management app
 */

class TodoApp {
    constructor() {
        this.tasks = [];
        this.tags = ['عمل', 'شخصي', 'دراسة', 'صحة', 'تسوق'];
        this.currentView = 'all';
        this.currentTheme = 'light';
        this.searchQuery = '';
        this.selectedTag = '';
        this.selectedDateFilter = '';
        
        // DOM elements
        this.elements = {};
        
        // Event handlers bound to this instance
        this.boundHandlers = {
            handleFormSubmit: this.handleAddTask.bind(this),
            handleEditFormSubmit: this.handleEditTask.bind(this),
            handleSearchInput: this.debounce(this.handleSearch.bind(this), 300),
            handleTagFilter: this.handleTagFilter.bind(this),
            handleDateFilter: this.handleDateFilter.bind(this),
            handleBottomNavClick: this.handleBottomNavClick.bind(this),
            handleThemeToggle: this.toggleTheme.bind(this),
            handleTasksListClick: this.handleTasksListClick.bind(this),
            handleModalClose: this.closeModal.bind(this),
            handleConfirmAction: this.handleConfirmAction.bind(this),
            handleTagManagement: this.handleTagManagement.bind(this),
            handleDataActions: this.handleDataActions.bind(this),
            handleOptionsToggle: this.handleOptionsToggle.bind(this),
            handleKeyboardShortcuts: this.handleKeyboardShortcuts.bind(this),
            handleTouchStart: this.handleTouchStart.bind(this),
            handleTouchMove: this.handleTouchMove.bind(this),
            handleTouchEnd: this.handleTouchEnd.bind(this)
        };
        
        // Touch/swipe handling
        this.touchState = {
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            isDragging: false,
            currentTask: null
        };
        
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.cacheElements();
        this.loadState();
        this.setupEventListeners();
        this.initializeSelects();
        this.renderTasks();
        this.updateStats();
        this.applyTheme();
        this.showWelcomeData();
    }

    /**
     * Cache DOM elements for better performance
     */
    cacheElements() {
        this.elements = {
            // Forms
            addTaskForm: document.getElementById('addTaskForm'),
            editTaskForm: document.getElementById('editTaskForm'),
            addTagForm: document.getElementById('addTagForm'),
            taskTitle: document.getElementById('taskTitle'),
            taskTag: document.getElementById('taskTag'),
            taskDue: document.getElementById('taskDue'),
            
            // Edit modal elements
            editTitle: document.getElementById('editTitle'),
            editTag: document.getElementById('editTag'),
            editDue: document.getElementById('editDue'),
            
            // Lists and containers
            tasksList: document.getElementById('tasksList'),
            tagsList: document.getElementById('tagsList'),
            emptyState: document.getElementById('emptyState'),
            
            // Navigation and views
            bottomNavItems: document.querySelectorAll('.bottom-nav__item'),
            tasksView: document.getElementById('tasksView'),
            settingsView: document.getElementById('settingsView'),
            
            // Search and filters
            searchInput: document.getElementById('searchInput'),
            searchClear: document.getElementById('searchClear'),
            tagFilter: document.getElementById('tagFilter'),
            dateFilter: document.getElementById('dateFilter'),
            
            // Stats
            totalTasks: document.getElementById('totalTasks'),
            completedTasks: document.getElementById('completedTasks'),
            
            // Theme and settings
            themeToggle: document.getElementById('themeToggle'),
            settingsTheme: document.getElementById('settingsTheme'),
            optionsToggle: document.getElementById('optionsToggle'),
            taskOptions: document.getElementById('taskOptions'),
            
            // Modals
            editModal: document.getElementById('editModal'),
            confirmModal: document.getElementById('confirmModal'),
            confirmTitle: document.getElementById('confirmTitle'),
            confirmMessage: document.getElementById('confirmMessage'),
            confirmAction: document.getElementById('confirmAction'),
            
            // Data actions
            exportData: document.getElementById('exportData'),
            clearData: document.getElementById('clearData'),
            newTagInput: document.getElementById('newTagInput'),
            
            // Toast container
            toasts: document.getElementById('toasts')
        };
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Form submissions
        this.elements.addTaskForm?.addEventListener('submit', this.boundHandlers.handleFormSubmit);
        this.elements.editTaskForm?.addEventListener('submit', this.boundHandlers.handleEditFormSubmit);
        this.elements.addTagForm?.addEventListener('submit', this.boundHandlers.handleTagManagement);
        
        // Search and filters
        this.elements.searchInput?.addEventListener('input', this.boundHandlers.handleSearchInput);
        this.elements.searchClear?.addEventListener('click', () => this.clearSearch());
        this.elements.tagFilter?.addEventListener('change', this.boundHandlers.handleTagFilter);
        this.elements.dateFilter?.addEventListener('change', this.boundHandlers.handleDateFilter);
        
        // Navigation
        this.elements.bottomNavItems?.forEach(item => {
            item.addEventListener('click', this.boundHandlers.handleBottomNavClick);
        });
        
        // Theme toggle
        this.elements.themeToggle?.addEventListener('click', this.boundHandlers.handleThemeToggle);
        this.elements.settingsTheme?.addEventListener('change', this.boundHandlers.handleThemeToggle);
        
        // Tasks list (using event delegation)
        this.elements.tasksList?.addEventListener('click', this.boundHandlers.handleTasksListClick);
        
        // Touch events for swipe gestures
        this.elements.tasksList?.addEventListener('touchstart', this.boundHandlers.handleTouchStart, { passive: false });
        this.elements.tasksList?.addEventListener('touchmove', this.boundHandlers.handleTouchMove, { passive: false });
        this.elements.tasksList?.addEventListener('touchend', this.boundHandlers.handleTouchEnd);
        
        // Modal handling
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-modal-close]')) {
                this.boundHandlers.handleModalClose(e);
            }
        });
        
        // Confirm modal
        this.elements.confirmAction?.addEventListener('click', this.boundHandlers.handleConfirmAction);
        
        // Data actions
        this.elements.exportData?.addEventListener('click', this.boundHandlers.handleDataActions);
        this.elements.clearData?.addEventListener('click', this.boundHandlers.handleDataActions);
        
        // Options toggle
        this.elements.optionsToggle?.addEventListener('click', this.boundHandlers.handleOptionsToggle);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.boundHandlers.handleKeyboardShortcuts);
        
        // Tags list event delegation
        this.elements.tagsList?.addEventListener('click', (e) => {
            if (e.target.closest('.tag-item__delete')) {
                const tagItem = e.target.closest('.tag-item');
                const tagText = tagItem.querySelector('.tag-item__text').textContent;
                this.removeTag(tagText);
            }
        });
    }

    /**
     * Initialize select dropdowns with current tags
     */
    initializeSelects() {
        const selects = [this.elements.taskTag, this.elements.editTag, this.elements.tagFilter];
        
        selects.forEach(select => {
            if (!select) return;
            
            // Keep the default "no category" option
            const defaultOption = select.querySelector('option[value=""]');
            select.innerHTML = '';
            if (defaultOption) {
                select.appendChild(defaultOption);
            }
            
            // Add tag options
            this.tags.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = tag;
                select.appendChild(option);
            });
        });
        
        this.renderTagsList();
    }

    /**
     * Handle add task form submission
     */
    handleAddTask(e) {
        e.preventDefault();
        
        const title = this.elements.taskTitle?.value.trim();
        if (!title) {
            this.showToast('يرجى إدخال عنوان المهمة', 'error');
            return;
        }
        
        const task = {
            id: this.generateId(),
            title,
            tag: this.elements.taskTag?.value || '',
            due: this.elements.taskDue?.value || '',
            done: false,
            createdAt: Date.now()
        };
        
        this.tasks.unshift(task);
        this.saveState();
        this.renderTasks();
        this.updateStats();
        
        // Reset form
        this.elements.addTaskForm?.reset();
        this.hideTaskOptions();
        
        this.showToast('تمت إضافة المهمة بنجاح', 'success');
    }

    /**
     * Handle edit task form submission
     */
    handleEditTask(e) {
        e.preventDefault();
        
        const taskId = this.elements.editTaskForm?.dataset.taskId;
        const task = this.tasks.find(t => t.id === taskId);
        
        if (!task) return;
        
        const title = this.elements.editTitle?.value.trim();
        if (!title) {
            this.showToast('يرجى إدخال عنوان المهمة', 'error');
            return;
        }
        
        task.title = title;
        task.tag = this.elements.editTag?.value || '';
        task.due = this.elements.editDue?.value || '';
        
        this.saveState();
        this.renderTasks();
        this.updateStats();
        this.closeModal();
        
        this.showToast('تم تحديث المهمة بنجاح', 'success');
    }

    /**
     * Handle search input with debouncing
     */
    handleSearch(e) {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.updateSearchClearButton();
        this.renderTasks();
    }

    /**
     * Clear search input
     */
    clearSearch() {
        if (this.elements.searchInput) {
            this.elements.searchInput.value = '';
        }
        this.searchQuery = '';
        this.updateSearchClearButton();
        this.renderTasks();
    }

    /**
     * Update search clear button visibility
     */
    updateSearchClearButton() {
        if (this.elements.searchClear) {
            this.elements.searchClear.classList.toggle('search__clear--visible', this.searchQuery.length > 0);
        }
    }

    /**
     * Handle tag filter change
     */
    handleTagFilter(e) {
        this.selectedTag = e.target.value;
        this.renderTasks();
    }

    /**
     * Handle date filter change
     */
    handleDateFilter(e) {
        this.selectedDateFilter = e.target.value;
        this.renderTasks();
    }

    /**
     * Handle bottom navigation clicks
     */
    handleBottomNavClick(e) {
        const item = e.currentTarget;
        const view = item.dataset.view;
        
        if (view) {
            this.switchView(view);
            
            // Update active state
            this.elements.bottomNavItems?.forEach(navItem => {
                navItem.classList.remove('bottom-nav__item--active');
            });
            item.classList.add('bottom-nav__item--active');
        }
    }

    /**
     * Switch between different views
     */
    switchView(view) {
        this.currentView = view;
        
        // Hide all views
        this.elements.tasksView?.style.setProperty('display', 'none');
        this.elements.settingsView?.style.setProperty('display', 'none');
        
        // Show selected view
        if (view === 'settings') {
            this.elements.settingsView?.style.setProperty('display', 'block');
        } else {
            this.elements.tasksView?.style.setProperty('display', 'block');
            this.renderTasks();
        }
    }

    /**
     * Toggle theme between light and dark
     */
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        this.saveState();
    }

    /**
     * Apply current theme to document
     */
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        
        // Update settings toggle
        if (this.elements.settingsTheme) {
            this.elements.settingsTheme.checked = this.currentTheme === 'dark';
        }
    }

    /**
     * Handle tasks list clicks (event delegation)
     */
    handleTasksListClick(e) {
        const task = e.target.closest('.task');
        if (!task) return;
        
        const taskId = task.dataset.taskId;
        
        // Handle checkbox toggle
        if (e.target.matches('.task__checkbox-input')) {
            this.toggleTaskDone(taskId);
            return;
        }
        
        // Handle edit button
        if (e.target.closest('.task__action--edit')) {
            this.openEditModal(taskId);
            return;
        }
        
        // Handle delete button
        if (e.target.closest('.task__action--delete')) {
            this.confirmDeleteTask(taskId);
            return;
        }
    }

    /**
     * Toggle task completion status
     */
    toggleTaskDone(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        task.done = !task.done;
        this.saveState();
        this.renderTasks();
        this.updateStats();
        
        const message = task.done ? 'تم إكمال المهمة' : 'تم إلغاء إكمال المهمة';
        this.showToast(message, task.done ? 'success' : 'info');
    }

    /**
     * Open edit modal for a task
     */
    openEditModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        // Populate form fields
        if (this.elements.editTitle) this.elements.editTitle.value = task.title;
        if (this.elements.editTag) this.elements.editTag.value = task.tag || '';
        if (this.elements.editDue) this.elements.editDue.value = task.due || '';
        
        // Store task ID in form
        if (this.elements.editTaskForm) {
            this.elements.editTaskForm.dataset.taskId = taskId;
        }
        
        this.openModal(this.elements.editModal);
    }

    /**
     * Confirm task deletion
     */
    confirmDeleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        if (this.elements.confirmTitle) {
            this.elements.confirmTitle.textContent = 'حذف المهمة';
        }
        if (this.elements.confirmMessage) {
            this.elements.confirmMessage.textContent = `هل أنت متأكد من حذف المهمة "${task.title}"؟`;
        }
        if (this.elements.confirmAction) {
            this.elements.confirmAction.dataset.action = 'deleteTask';
            this.elements.confirmAction.dataset.taskId = taskId;
        }
        
        this.openModal(this.elements.confirmModal);
    }

    /**
     * Delete a task
     */
    deleteTask(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveState();
        this.renderTasks();
        this.updateStats();
        this.closeModal();
        this.showToast('تم حذف المهمة', 'success');
    }

    /**
     * Open modal
     */
    openModal(modal) {
        if (modal) {
            modal.classList.add('show');
            modal.style.display = 'flex';
            // Focus management for accessibility
            const firstInput = modal.querySelector('input, button');
            if (firstInput) firstInput.focus();
        }
    }

    /**
     * Close modal
     */
    closeModal() {
        const modals = [this.elements.editModal, this.elements.confirmModal];
        modals.forEach(modal => {
            if (modal) {
                modal.classList.remove('show');
                modal.style.display = 'none';
            }
        });
    }

    /**
     * Handle modal close events
     */
    handleModalClose(e) {
        e.preventDefault();
        this.closeModal();
    }

    /**
     * Handle confirm action
     */
    handleConfirmAction(e) {
        const action = e.target.dataset.action;
        const taskId = e.target.dataset.taskId;
        
        switch (action) {
            case 'deleteTask':
                this.deleteTask(taskId);
                break;
            case 'clearData':
                this.clearAllData();
                break;
        }
    }

    /**
     * Filter tasks based on current view and filters
     */
    getFilteredTasks() {
        let filtered = [...this.tasks];
        
        // Filter by search query
        if (this.searchQuery) {
            filtered = filtered.filter(task =>
                task.title.toLowerCase().includes(this.searchQuery)
            );
        }
        
        // Filter by tag
        if (this.selectedTag) {
            filtered = filtered.filter(task => task.tag === this.selectedTag);
        }
        
        // Filter by date
        if (this.selectedDateFilter) {
            const today = new Date().toISOString().split('T')[0];
            const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            switch (this.selectedDateFilter) {
                case 'today':
                    filtered = filtered.filter(task => task.due === today);
                    break;
                case 'week':
                    filtered = filtered.filter(task => task.due && task.due <= weekFromNow && task.due >= today);
                    break;
                case 'overdue':
                    filtered = filtered.filter(task => task.due && task.due < today && !task.done);
                    break;
            }
        }
        
        // Filter by view
        switch (this.currentView) {
            case 'today':
                const todayDate = new Date().toISOString().split('T')[0];
                filtered = filtered.filter(task => task.due === todayDate || (!task.due && !task.done));
                break;
            case 'completed':
                filtered = filtered.filter(task => task.done);
                break;
            case 'all':
            default:
                // Show all tasks (already filtered by search/tag/date above)
                break;
        }
        
        return filtered;
    }

    /**
     * Render tasks list
     */
    renderTasks() {
        const filteredTasks = this.getFilteredTasks();
        
        if (!this.elements.tasksList || !this.elements.emptyState) return;
        
        if (filteredTasks.length === 0) {
            this.elements.tasksList.style.display = 'none';
            this.elements.emptyState.style.display = 'block';
        } else {
            this.elements.tasksList.style.display = 'block';
            this.elements.emptyState.style.display = 'none';
            
            // Use DocumentFragment for better performance
            const fragment = document.createDocumentFragment();
            
            filteredTasks.forEach(task => {
                const taskElement = this.createTaskElement(task);
                fragment.appendChild(taskElement);
            });
            
            this.elements.tasksList.innerHTML = '';
            this.elements.tasksList.appendChild(fragment);
        }
    }

    /**
     * Create task element
     */
    createTaskElement(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = `task ${task.done ? 'task--completed' : ''}`;
        taskDiv.setAttribute('data-task-id', task.id);
        taskDiv.setAttribute('role', 'listitem');
        
        const dueDate = this.formatDueDate(task.due);
        const tagHtml = task.tag ? `<span class="task__tag task__tag--${task.tag.toLowerCase()}">${task.tag}</span>` : '';
        
        taskDiv.innerHTML = `
            <div class="task__checkbox">
                <input 
                    type="checkbox" 
                    class="task__checkbox-input" 
                    id="task-${task.id}"
                    ${task.done ? 'checked' : ''}
                    aria-label="تحديد المهمة كمكتملة"
                >
                <label for="task-${task.id}" class="task__checkbox-custom">
                    <svg class="icon" viewBox="0 0 24 24" fill="none">
                        <polyline points="20,6 9,17 4,12"/>
                    </svg>
                </label>
            </div>
            
            <div class="task__content">
                <h4 class="task__title">${this.escapeHtml(task.title)}</h4>
                <div class="task__meta">
                    ${tagHtml}
                    ${dueDate ? `<span class="task__due ${this.getDueDateClass(task.due)}">
                        <svg class="icon" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        ${dueDate}
                    </span>` : ''}
                </div>
            </div>
            
            <div class="task__actions">
                <button class="task__action task__action--edit" aria-label="تعديل المهمة">
                    <svg class="icon" viewBox="0 0 24 24" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="task__action task__action--delete" aria-label="حذف المهمة">
                    <svg class="icon" viewBox="0 0 24 24" fill="none">
                        <polyline points="3,6 5,6 21,6"/>
                        <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/>
                    </svg>
                </button>
            </div>
        `;
        
        // Add animation class
        taskDiv.classList.add('animate-slide-up');
        
        return taskDiv;
    }

    /**
     * Format due date for display
     */
    formatDueDate(due) {
        if (!due) return '';
        
        const dueDate = new Date(due);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Reset time for comparison
        today.setHours(0, 0, 0, 0);
        tomorrow.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate.getTime() === today.getTime()) {
            return 'اليوم';
        } else if (dueDate.getTime() === tomorrow.getTime()) {
            return 'غداً';
        } else {
            return dueDate.toLocaleDateString('ar-SA', {
                month: 'short',
                day: 'numeric'
            });
        }
    }

    /**
     * Get CSS class for due date styling
     */
    getDueDateClass(due) {
        if (!due) return '';
        
        const dueDate = new Date(due);
        const today = new Date();
        
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate.getTime() < today.getTime()) {
            return 'task__due--overdue';
        } else if (dueDate.getTime() === today.getTime()) {
            return 'task__due--today';
        }
        
        return '';
    }

    /**
     * Update statistics
     */
    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.done).length;
        
        if (this.elements.totalTasks) {
            this.elements.totalTasks.textContent = total;
        }
        if (this.elements.completedTasks) {
            this.elements.completedTasks.textContent = completed;
        }
    }

    /**
     * Handle tag management (add new tag)
     */
    handleTagManagement(e) {
        e.preventDefault();
        
        const tagName = this.elements.newTagInput?.value.trim();
        if (!tagName) return;
        
        if (this.tags.includes(tagName)) {
            this.showToast('التصنيف موجود مسبقاً', 'warning');
            return;
        }
        
        this.tags.push(tagName);
        this.saveState();
        this.initializeSelects();
        
        // Reset form
        if (this.elements.newTagInput) {
            this.elements.newTagInput.value = '';
        }
        
        this.showToast('تمت إضافة التصنيف بنجاح', 'success');
    }

    /**
     * Remove a tag
     */
    removeTag(tagName) {
        // Remove tag from tags array
        this.tags = this.tags.filter(tag => tag !== tagName);
        
        // Remove tag from existing tasks
        this.tasks.forEach(task => {
            if (task.tag === tagName) {
                task.tag = '';
            }
        });
        
        this.saveState();
        this.initializeSelects();
        this.renderTasks();
        
        this.showToast('تم حذف التصنيف', 'success');
    }

    /**
     * Render tags list in settings
     */
    renderTagsList() {
        if (!this.elements.tagsList) return;
        
        const fragment = document.createDocumentFragment();
        
        this.tags.forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.className = 'tag-item';
            tagElement.innerHTML = `
                <span class="tag-item__text">${this.escapeHtml(tag)}</span>
                <button class="tag-item__delete" aria-label="حذف التصنيف ${tag}">
                    <svg class="icon" viewBox="0 0 24 24" fill="none">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            `;
            fragment.appendChild(tagElement);
        });
        
        this.elements.tagsList.innerHTML = '';
        this.elements.tagsList.appendChild(fragment);
    }

    /**
     * Handle data export/clear actions
     */
    handleDataActions(e) {
        const action = e.target.id;
        
        switch (action) {
            case 'exportData':
                this.exportData();
                break;
            case 'clearData':
                this.confirmClearData();
                break;
        }
    }

    /**
     * Export data as JSON
     */
    exportData() {
        const data = {
            tasks: this.tasks,
            tags: this.tags,
            theme: this.currentTheme,
            exportDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `todo-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(link.href);
        this.showToast('تم تصدير البيانات بنجاح', 'success');
    }

    /**
     * Confirm data clearing
     */
    confirmClearData() {
        if (this.elements.confirmTitle) {
            this.elements.confirmTitle.textContent = 'مسح جميع البيانات';
        }
        if (this.elements.confirmMessage) {
            this.elements.confirmMessage.textContent = 'هل أنت متأكد من مسح جميع المهام والتصنيفات؟ لا يمكن التراجع عن هذا الإجراء.';
        }
        if (this.elements.confirmAction) {
            this.elements.confirmAction.dataset.action = 'clearData';
            this.elements.confirmAction.textContent = 'مسح البيانات';
        }
        
        this.openModal(this.elements.confirmModal);
    }

    /**
     * Clear all data
     */
    clearAllData() {
        this.tasks = [];
        this.tags = ['عمل', 'شخصي', 'دراسة', 'صحة', 'تسوق'];
        this.saveState();
        this.initializeSelects();
        this.renderTasks();
        this.updateStats();
        this.closeModal();
        
        this.showToast('تم مسح جميع البيانات', 'success');
    }

    /**
     * Handle options toggle
     */
    handleOptionsToggle() {
        if (this.elements.taskOptions) {
            this.elements.taskOptions.classList.toggle('show');
        }
    }

    /**
     * Hide task options
     */
    hideTaskOptions() {
        if (this.elements.taskOptions) {
            this.elements.taskOptions.classList.remove('show');
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // Escape key closes modals
        if (e.key === 'Escape') {
            this.closeModal();
            return;
        }
        
        // Ctrl/Cmd + N adds new task
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            this.elements.taskTitle?.focus();
            return;
        }
        
        // Ctrl/Cmd + F focuses search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            this.elements.searchInput?.focus();
            return;
        }
    }

    /**
     * Touch event handlers for swipe gestures
     */
    handleTouchStart(e) {
        const task = e.target.closest('.task');
        if (!task) return;
        
        const touch = e.touches[0];
        this.touchState = {
            startX: touch.clientX,
            startY: touch.clientY,
            currentX: touch.clientX,
            currentY: touch.clientY,
            isDragging: false,
            currentTask: task
        };
    }

    handleTouchMove(e) {
        if (!this.touchState.currentTask) return;
        
        const touch = e.touches[0];
        this.touchState.currentX = touch.clientX;
        this.touchState.currentY = touch.clientY;
        
        const deltaX = this.touchState.currentX - this.touchState.startX;
        const deltaY = this.touchState.currentY - this.touchState.startY;
        
        // Only start dragging if horizontal movement is greater than vertical
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            this.touchState.isDragging = true;
            e.preventDefault();
            
            // Apply visual feedback
            if (deltaX > 50) {
                this.touchState.currentTask.classList.add('task--swiping-right');
                this.touchState.currentTask.classList.remove('task--swiping-left');
            } else if (deltaX < -50) {
                this.touchState.currentTask.classList.add('task--swiping-left');
                this.touchState.currentTask.classList.remove('task--swiping-right');
            } else {
                this.touchState.currentTask.classList.remove('task--swiping-right', 'task--swiping-left');
            }
        }
    }

    handleTouchEnd(e) {
        if (!this.touchState.currentTask || !this.touchState.isDragging) {
            this.resetTouchState();
            return;
        }
        
        const deltaX = this.touchState.currentX - this.touchState.startX;
        const taskId = this.touchState.currentTask.dataset.taskId;
        
        // Remove visual feedback classes
        this.touchState.currentTask.classList.remove('task--swiping-right', 'task--swiping-left');
        
        // Handle swipe actions
        if (deltaX > 100) {
            // Swipe right - complete task
            this.toggleTaskDone(taskId);
        } else if (deltaX < -100) {
            // Swipe left - delete task
            this.confirmDeleteTask(taskId);
        }
        
        this.resetTouchState();
    }

    /**
     * Reset touch state
     */
    resetTouchState() {
        this.touchState = {
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            isDragging: false,
            currentTask: null
        };
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 4000) {
        if (!this.elements.toasts) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        
        const icons = {
            success: '<polyline points="20,6 9,17 4,12"/>',
            error: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
            warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
            info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
        };
        
        toast.innerHTML = `
            <svg class="icon toast__icon" viewBox="0 0 24 24" fill="none">
                ${icons[type] || icons.info}
            </svg>
            <div class="toast__content">
                <div class="toast__message">${this.escapeHtml(message)}</div>
            </div>
            <button class="toast__close" aria-label="إغلاق الإشعار">
                <svg class="icon" viewBox="0 0 24 24" fill="none">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <div class="toast__progress"></div>
        `;
        
        // Add close functionality
        const closeBtn = toast.querySelector('.toast__close');
        closeBtn?.addEventListener('click', () => this.removeToast(toast));
        
        this.elements.toasts.appendChild(toast);
        
        // Auto remove after duration
        setTimeout(() => this.removeToast(toast), duration);
    }

    /**
     * Remove toast notification
     */
    removeToast(toast) {
        if (toast && toast.parentNode) {
            toast.style.animation = 'fadeOut var(--transition-fast) ease-out';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 150);
        }
    }

    /**
     * Load state from localStorage
     */
    loadState() {
        try {
            const saved = localStorage.getItem('todoApp');
            if (saved) {
                const data = JSON.parse(saved);
                this.tasks = data.tasks || [];
                this.tags = data.tags || ['عمل', 'شخصي', 'دراسة', 'صحة', 'تسوق'];
                this.currentTheme = data.theme || 'light';
            }
        } catch (error) {
            console.warn('Failed to load saved state:', error);
            this.showWelcomeData();
        }
    }

    /**
     * Save state to localStorage
     */
    saveState() {
        try {
            const data = {
                tasks: this.tasks,
                tags: this.tags,
                theme: this.currentTheme
            };
            localStorage.setItem('todoApp', JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save state:', error);
            this.showToast('فشل في حفظ البيانات', 'error');
        }
    }

    /**
     * Show welcome data for first-time users
     */
    showWelcomeData() {
        if (this.tasks.length === 0) {
            const welcomeTasks = [
                {
                    id: this.generateId(),
                    title: 'مرحباً بك في تطبيق قائمة المهام!',
                    tag: 'شخصي',
                    due: new Date().toISOString().split('T')[0],
                    done: false,
                    createdAt: Date.now() - 10000
                },
                {
                    id: this.generateId(),
                    title: 'جرب إضافة مهمة جديدة',
                    tag: '',
                    due: '',
                    done: false,
                    createdAt: Date.now() - 5000
                },
                {
                    id: this.generateId(),
                    title: 'استكشف الإعدادات لتخصيص التطبيق',
                    tag: 'عمل',
                    due: '',
                    done: true,
                    createdAt: Date.now()
                }
            ];
            
            this.tasks = welcomeTasks;
            this.saveState();
        }
    }

    /**
     * Utility: Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Utility: Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Utility: Escape HTML
     */
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TodoApp();
});

// Export for potential testing/extension
window.TodoApp = TodoApp;