// CSSnitch Background Script - Universal WebSocket Implementation
console.log('🚀 Safari Extension: Background script loaded!');

class CSSnitchWebSocketClient {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnecting = false;

        this.connect();
    }

    connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        this.isConnecting = true;
        console.log('🔌 Safari Extension: Attempting to connect to CSSnitch Tauri app on ws://localhost:8080...');

        try {
            this.ws = new WebSocket('ws://localhost:8080');

            this.ws.onopen = () => {
                console.log('✅ Safari Extension: Connected to CSSnitch Tauri app on ws://localhost:8080');
                this.reconnectAttempts = 0;
                this.isConnecting = false;
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('📥 Received from Tauri app:', message);

                    // Handle CSS updates from Tauri app
                    if (message.type === 'css-update') {
                        this.sendToContentScript(message);
                    }
                } catch (error) {
                    console.error('❌ Failed to parse message from Tauri app:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('🔌 Disconnected from CSSnitch Tauri app');
                this.isConnecting = false;
                this.scheduleReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.isConnecting = false;
            };

        } catch (error) {
            console.error('❌ Failed to create WebSocket connection:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay);

            // Exponential backoff
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000);
        } else {
            console.log('❌ Max reconnection attempts reached. Please restart CSSnitch Tauri app.');
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(data));
                console.log('📤 Sent to Tauri app:', data);
                return true;
            } catch (error) {
                console.error('❌ Failed to send data:', error);
                return false;
            }
        } else {
            console.warn('⚠️ WebSocket not connected. Attempting to reconnect...');
            this.connect();
            return false;
        }
    }

    sendToContentScript(message) {
        // Send CSS updates back to content script
        if (typeof safari !== 'undefined' && safari.extension) {
            // Safari - broadcast to all tabs
            safari.extension.dispatchMessage('css-update', message);
        } else if (typeof browser !== 'undefined' && browser.tabs) {
            // Chrome/Firefox - send to all tabs
            browser.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.url && (tab.url.includes('localhost') || tab.url.includes('.dev'))) {
                        browser.tabs.sendMessage(tab.id, message).catch(() => {
                            // Ignore errors for tabs without content script
                        });
                    }
                });
            });
        }
    }
}

// Initialize WebSocket client
const wsClient = new CSSnitchWebSocketClient();

// Handle messages from content scripts
if (typeof safari !== 'undefined' && safari.extension) {
    // Safari extension messaging
    safari.extension.addEventListener('message', (event) => {
        console.log('Background received Safari message:', event.name, event.message);

        if (event.name === 'sendToTauri') {
            wsClient.send({
                type: 'dom-inspection',
                data: event.message,
                timestamp: Date.now()
            });
        }
    });
} else if (typeof browser !== 'undefined' && browser.runtime) {
    // Chrome/Firefox messaging
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Background received message:', message);

        if (message.type === 'sendToTauri') {
            const success = wsClient.send({
                type: 'dom-inspection',
                data: message.data,
                timestamp: Date.now()
            });
            sendResponse({ success });
        }

        return true; // Keep message channel open for async response
    });
}
