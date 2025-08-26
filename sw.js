/**
 * Service Worker for Arabic To-Do App
 * Handles offline functionality, caching, and background sync
 */

const CACHE_NAME = 'arabic-todo-v1.0.0';
const STATIC_CACHE = 'static-v1.0.0';
const DYNAMIC_CACHE = 'dynamic-v1.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/styles/base.css',
  '/styles/components.css',
  '/styles/themes.css',
  '/scripts/app.js',
  '/scripts/offline-manager.js',
  '/scripts/sync-manager.js',
  '/manifest.json'
];

// Install event - cache static files
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Static files cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Error caching static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated successfully');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached files when offline
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached version if available
        if (cachedResponse) {
          return cachedResponse;
        }

        // Try to fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Don't cache non-successful responses
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clone the response for caching
            const responseToCache = networkResponse.clone();

            // Cache dynamic content
            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            // Return a basic offline response for other requests
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Background sync for data synchronization
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

// Push notification handling
self.addEventListener('push', event => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'تحديث جديد متاح',
    icon: '/manifest-icon-192.png',
    badge: '/manifest-icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: 'todo-update',
    requireInteraction: false,
    actions: [
      {
        action: 'view',
        title: 'عرض',
        icon: '/manifest-icon-192.png'
      },
      {
        action: 'dismiss',
        title: 'إغلاق'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('قائمة المهام', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handling from main thread
self.addEventListener('message', event => {
  console.log('Service Worker: Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SYNC_REQUEST') {
    // Trigger background sync
    self.registration.sync.register('sync-tasks');
  }
});

/**
 * Sync tasks with server (placeholder for actual implementation)
 */
async function syncTasks() {
  try {
    console.log('Service Worker: Syncing tasks...');
    
    // Get pending sync data from IndexedDB
    const pendingData = await getPendingSyncData();
    
    if (pendingData.length === 0) {
      console.log('Service Worker: No pending sync data');
      return;
    }

    // Attempt to sync with server
    for (const item of pendingData) {
      try {
        await syncSingleItem(item);
        await removePendingSyncItem(item.id);
      } catch (error) {
        console.error('Service Worker: Failed to sync item:', item.id, error);
      }
    }
    
    // Notify main thread of sync completion
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        success: true
      });
    });
    
  } catch (error) {
    console.error('Service Worker: Sync failed:', error);
    
    // Notify main thread of sync failure
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        success: false,
        error: error.message
      });
    });
  }
}

/**
 * Get pending sync data from IndexedDB
 */
async function getPendingSyncData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TodoAppDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingSync'], 'readonly');
      const store = transaction.objectStore('pendingSync');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result || []);
      };
      
      getAllRequest.onerror = () => {
        reject(getAllRequest.error);
      };
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Sync single item with server
 */
async function syncSingleItem(item) {
  // Placeholder for actual server sync logic
  console.log('Service Worker: Syncing item:', item);
  
  // Simulate network request
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // In a real implementation, this would make an actual API call
  // const response = await fetch('/api/sync', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(item)
  // });
  
  // if (!response.ok) {
  //   throw new Error(`Sync failed: ${response.statusText}`);
  // }
}

/**
 * Remove synced item from pending queue
 */
async function removePendingSyncItem(itemId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TodoAppDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingSync'], 'readwrite');
      const store = transaction.objectStore('pendingSync');
      const deleteRequest = store.delete(itemId);
      
      deleteRequest.onsuccess = () => {
        resolve();
      };
      
      deleteRequest.onerror = () => {
        reject(deleteRequest.error);
      };
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}
