/**
 * Sync Manager - Handles data synchronization between local and remote storage
 */

class SyncManager {
    constructor() {
        this.dbName = 'TodoAppDB';
        this.dbVersion = 1;
        this.db = null;
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        this.lastSyncTime = null;
        
        this.init();
    }

    /**
     * Initialize sync manager
     */
    async init() {
        try {
            await this.initIndexedDB();
            this.loadLastSyncTime();
            this.setupNetworkListeners();
            console.log('Sync Manager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Sync Manager:', error);
        }
    }

    /**
     * Initialize IndexedDB
     */
    initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB opened successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create tasks store
                if (!db.objectStoreNames.contains('tasks')) {
                    const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
                    tasksStore.createIndex('createdAt', 'createdAt', { unique: false });
                    tasksStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                    tasksStore.createIndex('done', 'done', { unique: false });
                }

                // Create tags store
                if (!db.objectStoreNames.contains('tags')) {
                    const tagsStore = db.createObjectStore('tags', { keyPath: 'name' });
                    tagsStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Create sync queue store
                if (!db.objectStoreNames.contains('pendingSync')) {
                    const syncStore = db.createObjectStore('pendingSync', { keyPath: 'id' });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                    syncStore.createIndex('operation', 'operation', { unique: false });
                }

                // Create metadata store
                if (!db.objectStoreNames.contains('metadata')) {
                    const metaStore = db.createObjectStore('metadata', { keyPath: 'key' });
                }

                console.log('IndexedDB schema created/updated');
            };
        });
    }

    /**
     * Setup network listeners
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processSyncQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    /**
     * Save data to IndexedDB
     */
    async saveToIndexedDB(storeName, data) {
        if (!this.db) {
            throw new Error('IndexedDB not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const request = Array.isArray(data) 
                ? this.bulkSave(store, data)
                : store.put(data);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Bulk save data to store
     */
    bulkSave(store, dataArray) {
        const promises = dataArray.map(item => {
            return new Promise((resolve, reject) => {
                const request = store.put(item);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });

        return Promise.all(promises);
    }

    /**
     * Load data from IndexedDB
     */
    async loadFromIndexedDB(storeName, key = null) {
        if (!this.db) {
            throw new Error('IndexedDB not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            const request = key ? store.get(key) : store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Delete data from IndexedDB
     */
    async deleteFromIndexedDB(storeName, key) {
        if (!this.db) {
            throw new Error('IndexedDB not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Add operation to sync queue
     */
    async addToSyncQueue(operation, data, entityType = 'task') {
        const syncItem = {
            id: this.generateSyncId(),
            operation, // 'create', 'update', 'delete'
            entityType,
            data,
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: 3
        };

        try {
            await this.saveToIndexedDB('pendingSync', syncItem);
            console.log('Added to sync queue:', syncItem);
            
            // Try to sync immediately if online
            if (this.isOnline) {
                this.processSyncQueue();
            }
        } catch (error) {
            console.error('Failed to add to sync queue:', error);
        }
    }

    /**
     * Process sync queue
     */
    async processSyncQueue() {
        if (!this.isOnline) {
            console.log('Offline - skipping sync queue processing');
            return;
        }

        try {
            const pendingItems = await this.loadFromIndexedDB('pendingSync');
            
            if (!pendingItems || pendingItems.length === 0) {
                console.log('No pending sync items');
                return;
            }

            console.log(`Processing ${pendingItems.length} sync items`);

            for (const item of pendingItems) {
                try {
                    await this.syncSingleItem(item);
                    await this.deleteFromIndexedDB('pendingSync', item.id);
                    console.log('Synced item:', item.id);
                } catch (error) {
                    console.error('Failed to sync item:', item.id, error);
                    await this.handleSyncFailure(item);
                }
            }

            this.updateLastSyncTime();
            this.notifySyncComplete(true);

        } catch (error) {
            console.error('Sync queue processing failed:', error);
            this.notifySyncComplete(false, error.message);
        }
    }

    /**
     * Sync single item with server
     */
    async syncSingleItem(item) {
        // Simulate API call - replace with actual server endpoints
        const delay = Math.random() * 1000 + 500; // 500-1500ms delay
        await new Promise(resolve => setTimeout(resolve, delay));

        // Simulate occasional failures for testing
        if (Math.random() < 0.1) { // 10% failure rate
            throw new Error('Simulated sync failure');
        }

        console.log(`Synced ${item.operation} for ${item.entityType}:`, item.data);

        // In a real implementation, you would make actual API calls here:
        /*
        const endpoint = this.getEndpointForOperation(item.operation, item.entityType);
        const response = await fetch(endpoint, {
            method: this.getMethodForOperation(item.operation),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.getAuthToken()
            },
            body: JSON.stringify(item.data)
        });

        if (!response.ok) {
            throw new Error(`Sync failed: ${response.statusText}`);
        }

        return await response.json();
        */
    }

    /**
     * Handle sync failure
     */
    async handleSyncFailure(item) {
        item.retryCount++;
        
        if (item.retryCount >= item.maxRetries) {
            console.error('Max retries reached for sync item:', item.id);
            // Move to failed sync store or handle as needed
            await this.deleteFromIndexedDB('pendingSync', item.id);
        } else {
            // Update retry count and try again later
            await this.saveToIndexedDB('pendingSync', item);
        }
    }

    /**
     * Sync tasks from localStorage to IndexedDB
     */
    async syncLocalStorageToIndexedDB() {
        try {
            // Get data from localStorage
            const localData = localStorage.getItem('todoApp');
            if (!localData) {
                console.log('No localStorage data to sync');
                return;
            }

            const data = JSON.parse(localData);
            
            // Sync tasks
            if (data.tasks && data.tasks.length > 0) {
                const tasksWithTimestamps = data.tasks.map(task => ({
                    ...task,
                    updatedAt: task.updatedAt || Date.now(),
                    synced: false
                }));
                
                await this.saveToIndexedDB('tasks', tasksWithTimestamps);
                console.log(`Synced ${tasksWithTimestamps.length} tasks to IndexedDB`);
            }

            // Sync tags
            if (data.tags && data.tags.length > 0) {
                const tagsWithTimestamps = data.tags.map(tag => ({
                    name: tag,
                    createdAt: Date.now(),
                    synced: false
                }));
                
                await this.saveToIndexedDB('tags', tagsWithTimestamps);
                console.log(`Synced ${tagsWithTimestamps.length} tags to IndexedDB`);
            }

            // Save metadata
            await this.saveToIndexedDB('metadata', {
                key: 'theme',
                value: data.theme || 'light',
                updatedAt: Date.now()
            });

        } catch (error) {
            console.error('Failed to sync localStorage to IndexedDB:', error);
        }
    }

    /**
     * Sync IndexedDB to localStorage (for backward compatibility)
     */
    async syncIndexedDBToLocalStorage() {
        try {
            const tasks = await this.loadFromIndexedDB('tasks');
            const tags = await this.loadFromIndexedDB('tags');
            const themeData = await this.loadFromIndexedDB('metadata', 'theme');

            const localStorageData = {
                tasks: tasks || [],
                tags: (tags || []).map(tag => tag.name),
                theme: themeData ? themeData.value : 'light'
            };

            localStorage.setItem('todoApp', JSON.stringify(localStorageData));
            console.log('Synced IndexedDB to localStorage');

        } catch (error) {
            console.error('Failed to sync IndexedDB to localStorage:', error);
        }
    }

    /**
     * Create backup of all data
     */
    async createBackup() {
        try {
            const tasks = await this.loadFromIndexedDB('tasks');
            const tags = await this.loadFromIndexedDB('tags');
            const metadata = await this.loadFromIndexedDB('metadata');

            const backup = {
                version: '1.0.0',
                timestamp: Date.now(),
                data: {
                    tasks: tasks || [],
                    tags: tags || [],
                    metadata: metadata || []
                }
            };

            return backup;
        } catch (error) {
            console.error('Failed to create backup:', error);
            throw error;
        }
    }

    /**
     * Restore from backup
     */
    async restoreFromBackup(backup) {
        try {
            if (!backup.data) {
                throw new Error('Invalid backup format');
            }

            // Clear existing data
            await this.clearAllData();

            // Restore tasks
            if (backup.data.tasks && backup.data.tasks.length > 0) {
                await this.saveToIndexedDB('tasks', backup.data.tasks);
            }

            // Restore tags
            if (backup.data.tags && backup.data.tags.length > 0) {
                await this.saveToIndexedDB('tags', backup.data.tags);
            }

            // Restore metadata
            if (backup.data.metadata && backup.data.metadata.length > 0) {
                await this.saveToIndexedDB('metadata', backup.data.metadata);
            }

            // Sync to localStorage for compatibility
            await this.syncIndexedDBToLocalStorage();

            console.log('Backup restored successfully');
            return true;

        } catch (error) {
            console.error('Failed to restore backup:', error);
            throw error;
        }
    }

    /**
     * Clear all data
     */
    async clearAllData() {
        try {
            const stores = ['tasks', 'tags', 'metadata', 'pendingSync'];
            
            for (const storeName of stores) {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                await new Promise((resolve, reject) => {
                    const request = store.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }

            console.log('All IndexedDB data cleared');
        } catch (error) {
            console.error('Failed to clear data:', error);
            throw error;
        }
    }

    /**
     * Get sync status
     */
    async getSyncStatus() {
        try {
            const pendingItems = await this.loadFromIndexedDB('pendingSync');
            
            return {
                hasPendingSync: pendingItems && pendingItems.length > 0,
                pendingCount: pendingItems ? pendingItems.length : 0,
                lastSyncTime: this.lastSyncTime,
                isOnline: this.isOnline
            };
        } catch (error) {
            console.error('Failed to get sync status:', error);
            return {
                hasPendingSync: false,
                pendingCount: 0,
                lastSyncTime: null,
                isOnline: this.isOnline
            };
        }
    }

    /**
     * Force sync now
     */
    async forceSyncNow() {
        if (!this.isOnline) {
            throw new Error('Cannot sync while offline');
        }

        await this.processSyncQueue();
    }

    /**
     * Load last sync time
     */
    loadLastSyncTime() {
        try {
            const saved = localStorage.getItem('lastSyncTime');
            this.lastSyncTime = saved ? parseInt(saved) : null;
        } catch (error) {
            console.warn('Failed to load last sync time:', error);
        }
    }

    /**
     * Update last sync time
     */
    updateLastSyncTime() {
        this.lastSyncTime = Date.now();
        localStorage.setItem('lastSyncTime', this.lastSyncTime.toString());
    }

    /**
     * Notify sync completion
     */
    notifySyncComplete(success, error = null) {
        const event = new CustomEvent('syncComplete', {
            detail: { success, error, timestamp: Date.now() }
        });
        window.dispatchEvent(event);
    }

    /**
     * Generate unique sync ID
     */
    generateSyncId() {
        return 'sync_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get endpoint for operation (placeholder)
     */
    getEndpointForOperation(operation, entityType) {
        const baseUrl = '/api';
        switch (operation) {
            case 'create':
                return `${baseUrl}/${entityType}s`;
            case 'update':
                return `${baseUrl}/${entityType}s`;
            case 'delete':
                return `${baseUrl}/${entityType}s`;
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }

    /**
     * Get HTTP method for operation
     */
    getMethodForOperation(operation) {
        switch (operation) {
            case 'create':
                return 'POST';
            case 'update':
                return 'PUT';
            case 'delete':
                return 'DELETE';
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
}

// Export for use in main app
window.SyncManager = SyncManager;
