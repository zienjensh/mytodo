/**
 * Offline Manager - Handles offline functionality and network detection
 */

class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.offlineMode = false;
        this.userPreference = null;
        this.callbacks = {
            statusChange: [],
            modeChange: []
        };
        
        this.init();
    }

    /**
     * Initialize offline manager
     */
    init() {
        this.setupNetworkListeners();
        this.loadUserPreference();
        this.showInitialModal();
        this.updateUI();
    }

    /**
     * Setup network event listeners
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            console.log('Network: Online');
            this.isOnline = true;
            this.handleNetworkChange();
        });

        window.addEventListener('offline', () => {
            console.log('Network: Offline');
            this.isOnline = false;
            this.handleNetworkChange();
        });

        // Additional connectivity checks
        this.startConnectivityMonitoring();
    }

    /**
     * Start periodic connectivity monitoring
     */
    startConnectivityMonitoring() {
        setInterval(() => {
            this.checkConnectivity();
        }, 30000); // Check every 30 seconds
    }

    /**
     * Check actual connectivity (not just navigator.onLine)
     */
    async checkConnectivity() {
        try {
            const response = await fetch('/manifest.json', {
                method: 'HEAD',
                cache: 'no-cache',
                timeout: 5000
            });
            
            const actuallyOnline = response.ok;
            
            if (actuallyOnline !== this.isOnline) {
                this.isOnline = actuallyOnline;
                this.handleNetworkChange();
            }
        } catch (error) {
            if (this.isOnline) {
                this.isOnline = false;
                this.handleNetworkChange();
            }
        }
    }

    /**
     * Handle network status changes
     */
    handleNetworkChange() {
        this.updateUI();
        this.notifyStatusChange();
        
        if (this.isOnline && !this.offlineMode) {
            this.triggerSync();
        }
    }

    /**
     * Show initial modal asking about offline preference
     */
    showInitialModal() {
        // Don't show if user has already made a choice
        if (this.userPreference !== null) {
            return;
        }

        const modal = this.createOfflineModal();
        document.body.appendChild(modal);
        
        // Show modal with animation
        setTimeout(() => {
            modal.classList.add('show');
        }, 100);
    }

    /**
     * Create offline preference modal
     */
    createOfflineModal() {
        const modal = document.createElement('div');
        modal.className = 'offline-modal';
        modal.innerHTML = `
            <div class="offline-modal__backdrop"></div>
            <div class="offline-modal__content">
                <div class="offline-modal__header">
                    <div class="offline-modal__icon">
                        <svg class="icon icon--xl" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                        </svg>
                    </div>
                    <h3 class="offline-modal__title">مرحباً بك في قائمة المهام</h3>
                </div>
                
                <div class="offline-modal__body">
                    <p class="offline-modal__description">
                        هل تريد استخدام التطبيق في الوضع غير المتصل؟
                    </p>
                    <div class="offline-modal__features">
                        <div class="offline-modal__feature">
                            <svg class="icon" viewBox="0 0 24 24" fill="none">
                                <path d="M9 12l2 2 4-4"/>
                                <circle cx="12" cy="12" r="10"/>
                            </svg>
                            <span>حفظ تلقائي للبيانات محلياً</span>
                        </div>
                        <div class="offline-modal__feature">
                            <svg class="icon" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                <path d="M2 17l10 5 10-5"/>
                                <path d="M2 12l10 5 10-5"/>
                            </svg>
                            <span>عمل بدون إنترنت</span>
                        </div>
                        <div class="offline-modal__feature">
                            <svg class="icon" viewBox="0 0 24 24" fill="none">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
                                <line x1="12" y1="22.08" x2="12" y2="12"/>
                            </svg>
                            <span>مزامنة تلقائية عند الاتصال</span>
                        </div>
                    </div>
                </div>
                
                <div class="offline-modal__footer">
                    <button class="btn btn--secondary" data-choice="online">
                        لا، استخدام متصل فقط
                    </button>
                    <button class="btn btn--primary" data-choice="offline">
                        نعم، تفعيل الوضع غير المتصل
                    </button>
                </div>
            </div>
        `;

        // Add event listeners
        modal.addEventListener('click', (e) => {
            const choice = e.target.dataset.choice;
            if (choice) {
                this.handleOfflineChoice(choice === 'offline');
                this.removeModal(modal);
            }
        });

        return modal;
    }

    /**
     * Handle user's offline preference choice
     */
    handleOfflineChoice(enableOffline) {
        this.userPreference = enableOffline;
        this.offlineMode = enableOffline;
        
        // Save preference
        localStorage.setItem('offlinePreference', JSON.stringify({
            enabled: enableOffline,
            timestamp: Date.now()
        }));

        // Register service worker if offline mode is enabled
        if (enableOffline) {
            this.registerServiceWorker();
        }

        this.updateUI();
        this.notifyModeChange();
        
        // Show confirmation toast
        if (window.todoApp) {
            const message = enableOffline 
                ? 'تم تفعيل الوضع غير المتصل بنجاح' 
                : 'سيتم استخدام التطبيق في الوضع المتصل فقط';
            window.todoApp.showToast(message, 'success');
        }
    }

    /**
     * Load user preference from storage
     */
    loadUserPreference() {
        try {
            const saved = localStorage.getItem('offlinePreference');
            if (saved) {
                const preference = JSON.parse(saved);
                this.userPreference = preference.enabled;
                this.offlineMode = preference.enabled;
                
                // Register service worker if offline mode was previously enabled
                if (preference.enabled) {
                    this.registerServiceWorker();
                }
            }
        } catch (error) {
            console.warn('Failed to load offline preference:', error);
        }
    }

    /**
     * Register service worker
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration);
                
                // Listen for service worker updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateAvailable();
                        }
                    });
                });

                // Listen for messages from service worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event.data);
                });

            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    /**
     * Handle messages from service worker
     */
    handleServiceWorkerMessage(data) {
        console.log('Message from Service Worker:', data);
        
        if (data.type === 'SYNC_COMPLETE') {
            if (window.todoApp) {
                const message = data.success 
                    ? 'تم مزامنة البيانات بنجاح' 
                    : 'فشل في مزامنة البيانات';
                const type = data.success ? 'success' : 'error';
                window.todoApp.showToast(message, type);
            }
        }
    }

    /**
     * Show update available notification
     */
    showUpdateAvailable() {
        if (window.todoApp) {
            window.todoApp.showToast(
                'تحديث جديد متاح. سيتم تطبيقه عند إعادة تحميل الصفحة.',
                'info',
                8000
            );
        }
    }

    /**
     * Remove modal from DOM
     */
    removeModal(modal) {
        modal.classList.add('hide');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }

    /**
     * Update UI based on current status
     */
    updateUI() {
        this.updateStatusIndicator();
        this.updateConnectionBadge();
    }

    /**
     * Update status indicator in header
     */
    updateStatusIndicator() {
        let indicator = document.querySelector('.connection-status');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'connection-status';
            
            const header = document.querySelector('.header__container');
            if (header) {
                header.appendChild(indicator);
            }
        }

        const isEffectivelyOffline = !this.isOnline || this.offlineMode;
        
        indicator.className = `connection-status ${isEffectivelyOffline ? 'connection-status--offline' : 'connection-status--online'}`;
        indicator.innerHTML = `
            <svg class="icon connection-status__icon" viewBox="0 0 24 24" fill="none">
                ${isEffectivelyOffline 
                    ? '<path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.07 2.93 1 9z"/><path d="M5 13l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.24 9.24 8.76 9.24 5 13z"/><path d="M9 17l2 2c.55-.55 1.45-.55 2 0l2-2C13.24 15.24 10.76 15.24 9 17z"/><line x1="1" y1="1" x2="23" y2="23"/>'
                    : '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>'
                }
            </svg>
            <span class="connection-status__text">
                ${isEffectivelyOffline ? 'غير متصل' : 'متصل'}
            </span>
        `;
    }

    /**
     * Update connection badge
     */
    updateConnectionBadge() {
        const badge = document.querySelector('.connection-badge');
        if (badge) {
            badge.textContent = this.isOnline ? 'متصل' : 'غير متصل';
            badge.className = `connection-badge ${this.isOnline ? 'connection-badge--online' : 'connection-badge--offline'}`;
        }
    }

    /**
     * Trigger background sync
     */
    triggerSync() {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'SYNC_REQUEST'
            });
        }
    }

    /**
     * Toggle offline mode manually
     */
    toggleOfflineMode() {
        this.offlineMode = !this.offlineMode;
        this.userPreference = this.offlineMode;
        
        // Save preference
        localStorage.setItem('offlinePreference', JSON.stringify({
            enabled: this.offlineMode,
            timestamp: Date.now()
        }));

        this.updateUI();
        this.notifyModeChange();

        if (window.todoApp) {
            const message = this.offlineMode 
                ? 'تم تفعيل الوضع غير المتصل' 
                : 'تم تفعيل الوضع المتصل';
            window.todoApp.showToast(message, 'info');
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isOnline: this.isOnline,
            offlineMode: this.offlineMode,
            effectivelyOffline: !this.isOnline || this.offlineMode
        };
    }

    /**
     * Add status change callback
     */
    onStatusChange(callback) {
        this.callbacks.statusChange.push(callback);
    }

    /**
     * Add mode change callback
     */
    onModeChange(callback) {
        this.callbacks.modeChange.push(callback);
    }

    /**
     * Notify status change callbacks
     */
    notifyStatusChange() {
        this.callbacks.statusChange.forEach(callback => {
            try {
                callback(this.getStatus());
            } catch (error) {
                console.error('Status change callback error:', error);
            }
        });
    }

    /**
     * Notify mode change callbacks
     */
    notifyModeChange() {
        this.callbacks.modeChange.forEach(callback => {
            try {
                callback(this.getStatus());
            } catch (error) {
                console.error('Mode change callback error:', error);
            }
        });
    }
}

// Export for use in main app
window.OfflineManager = OfflineManager;
