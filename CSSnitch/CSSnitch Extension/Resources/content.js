// CSSnitch Content Script - DOM Inspector
console.log('🎯 CSSnitch DOM Inspector loaded');

// WebSocket connection for Tauri app
let tauriWebSocket = null;

function connectToTauriApp() {
  if (tauriWebSocket && tauriWebSocket.readyState === WebSocket.OPEN) {
    return;
  }
  
  console.log('🔌 Content Script: Connecting to Tauri app on ws://localhost:8080...');
  
  try {
    tauriWebSocket = new WebSocket('ws://localhost:8080');
    console.log('🔌 Content Script: WebSocket object created, readyState:', tauriWebSocket.readyState);
    
    tauriWebSocket.onopen = () => {
      console.log('✅ Content Script: Connected to Tauri app!');
      // Send a test message immediately
      const testMessage = {
        type: 'connection-test',
        message: 'Hello from Safari extension!',
        timestamp: Date.now()
      };
      tauriWebSocket.send(JSON.stringify(testMessage));
      console.log('📤 Content Script: Sent test message to Tauri');
    };
    
    tauriWebSocket.onmessage = (event) => {
      console.log('📥 Content Script: Received from Tauri app:', event.data);
    };
    
    tauriWebSocket.onclose = () => {
      console.log('🔌 Content Script: Disconnected from Tauri app');
      // Retry connection after 2 seconds
      setTimeout(connectToTauriApp, 2000);
    };
    
    tauriWebSocket.onerror = (error) => {
      console.error('❌ Content Script: WebSocket error:', error);
    };
  } catch (error) {
    console.error('❌ Content Script: Failed to create WebSocket:', error);
    setTimeout(connectToTauriApp, 2000);
  }
}

class CSSnitchWebExtension {
  constructor() {
    this.isActive = false;
    this.overlay = null;
    this.currentElement = null;
    this.setupInspector();
  }
  
  setupInspector() {
    // Only activate on development sites
    if (this.isDevelopmentSite()) {
      this.createOverlay();
      this.setupEventListeners();
      console.log('🔥 CSSnitch activated for development site');
      
      // Connect to Tauri app
      connectToTauriApp();
    } else {
      console.log('⚠️ CSSnitch only works on development sites (localhost, .dev, etc.)');
    }
  }
  
  isDevelopmentSite() {
    const hostname = window.location.hostname;
    return hostname === 'localhost' ||
           hostname === '127.0.0.1' ||
           hostname.endsWith('.local') ||
           hostname.endsWith('.dev') ||
           window.location.port !== '';
  }
  
  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'cssnitch-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #ff6b6b;
      background: rgba(255, 107, 107, 0.1);
      z-index: 999999;
      display: none;
      border-radius: 3px;
      box-shadow: 0 0 10px rgba(255, 107, 107, 0.5);
    `;
    document.body.appendChild(this.overlay);
  }
  
  setupEventListeners() {
    // Toggle inspector with Cmd+Shift+P (Mac) or Ctrl+Shift+P (others)
    document.addEventListener('keydown', (e) => {
      console.log('🔑 Key pressed:', e.key, 'metaKey:', e.metaKey, 'ctrlKey:', e.ctrlKey, 'shiftKey:', e.shiftKey);
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        console.log('🎯 Keyboard shortcut detected! Toggling inspector...');
        e.preventDefault();
        this.toggleInspector();
      }
    });
    
    // Mouse events for inspection
    document.addEventListener('mouseover', (e) => {
      if (this.isActive) {
        this.highlightElement(e.target);
      }
    });
    
    document.addEventListener('click', (e) => {
      if (this.isActive) {
        e.preventDefault();
        e.stopPropagation();
        this.inspectElement(e.target);
      }
    }, true);
  }
  
  toggleInspector() {
    console.log('🔄 toggleInspector called, current state:', this.isActive);
    this.isActive = !this.isActive;
    
    if (this.isActive) {
      console.log('✅ Activating inspector');
      document.body.style.cursor = 'crosshair';
      this.showNotification('🎯 CSSnitch Inspector Active - Click any element');
    } else {
      console.log('❌ Deactivating inspector');
      document.body.style.cursor = '';
      this.overlay.style.display = 'none';
      this.showNotification('CSSnitch Inspector Deactivated');
    }
  }
  
  highlightElement(element) {
    if (element === document.body || element === document.documentElement) return;
    
    const rect = element.getBoundingClientRect();
    this.overlay.style.cssText += `
      display: block;
      left: ${rect.left + window.scrollX}px;
      top: ${rect.top + window.scrollY}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
    `;
    
    this.currentElement = element;
  }
  
  inspectElement(element) {
    console.log('🔍 Inspecting element:', element);
    
    const domData = this.extractDOMData(element);
    const componentInfo = this.detectComponent(element);
    
    const inspectionData = {
      element: domData,
      component_info: componentInfo,
      mouse_position: [0, 0], // We'll get this from click event
      page_url: window.location.href,
      timestamp: Date.now()
    };
    
    // Send to Tauri app via native messaging
    this.sendToTauriApp(inspectionData);
    
    // Show success notification
    this.showNotification(`📤 Sent ${element.tagName.toLowerCase()} data to CSSnitch app`);
  }
  
  extractDOMData(element) {
    return {
      tag_name: element.tagName.toLowerCase(),
      id: element.id || undefined,
      class_name: element.className || undefined,
      attributes: this.getAttributes(element),
      text_content: element.textContent?.trim().substring(0, 100) || undefined,
      children: [], // We'll keep this simple for now
      css_selector: this.generateSelector(element),
      computed_styles: this.getComputedStyles(element)
    };
  }
  
  detectComponent(element) {
    // Vue.js component detection
    let current = element;
    while (current && current !== document.body) {
      if (current.__vue__) {
        const vue = current.__vue__;
        return {
          file_path: vue.$options.__file || undefined,
          component_name: vue.$options.name || vue.$options._componentTag || undefined,
          framework: "Vue",
          css_scope: "scoped", // Assume scoped for now
          line_number: undefined,
          css_selector_in_source: this.generateSelector(element)
        };
      }
      
      // React component detection
      const reactKey = Object.keys(current).find(key => 
        key.startsWith('__reactInternalInstance') ||
        key.startsWith('__reactFiber')
      );
      
      if (reactKey) {
        const react = current[reactKey];
        return {
          file_path: react._debugSource?.fileName || undefined,
          component_name: react.type?.name || react.elementType?.name || undefined,
          framework: "React",
          css_scope: "module",
          line_number: react._debugSource?.lineNumber || undefined,
          css_selector_in_source: this.generateSelector(element)
        };
      }
      
      current = current.parentElement;
    }
    
    return null; // No component detected
  }
  
  getAttributes(element) {
    const attrs = {};
    for (let attr of element.attributes) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }
  
  getComputedStyles(element) {
    const computed = window.getComputedStyle(element);
    const styles = {};
    
    // Important CSS properties to capture
    const importantProps = [
      'color', 'background-color', 'font-size', 'font-weight', 'font-family',
      'padding', 'margin', 'border', 'border-radius', 'width', 'height',
      'display', 'position', 'top', 'left', 'right', 'bottom',
      'flex-direction', 'justify-content', 'align-items', 'gap'
    ];
    
    importantProps.forEach(prop => {
      const value = computed.getPropertyValue(prop);
      if (value && value !== 'none' && value !== 'auto') {
        styles[prop] = value;
      }
    });
    
    return styles;
  }
  
  generateSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    
    let selector = element.tagName.toLowerCase();
    
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }
    
    return selector;
  }
  
  sendToTauriApp(data) {
    try {
      // Send directly via WebSocket from content script
      if (tauriWebSocket && tauriWebSocket.readyState === WebSocket.OPEN) {
        const message = {
          type: 'dom-inspection',
          data: data,
          timestamp: Date.now()
        };
        
        tauriWebSocket.send(JSON.stringify(message));
        console.log('📤 Content Script: Sent DOM data to Tauri app:', data);
        this.showNotification(`📤 Sent ${data.element.tag_name} data to CSSnitch app`);
      } else {
        console.warn('⚠️ Content Script: WebSocket not connected to Tauri app');
        this.showNotification('❌ Not connected to CSSnitch app');
        // Try to reconnect
        connectToTauriApp();
      }
    } catch (error) {
      console.error('❌ Content Script: Failed to send to Tauri app:', error);
      this.showNotification('❌ Failed to send to CSSnitch app');
    }
  }
  
  showNotification(message) {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 1000000;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
  
  applyCSSUpdate(updateData) {
    try {
      console.log('🎨 Applying CSS update:', updateData);
      
      if (updateData.selector && updateData.styles) {
        const elements = document.querySelectorAll(updateData.selector);
        
        elements.forEach(element => {
          Object.entries(updateData.styles).forEach(([property, value]) => {
            element.style[property] = value;
          });
        });
        
        this.showNotification(`🎨 Applied CSS changes to ${elements.length} element(s)`);
      }
    } catch (error) {
      console.error('❌ Failed to apply CSS update:', error);
      this.showNotification('❌ Failed to apply CSS changes');
    }
  }
}

// Initialize CSSnitch Web Extension Inspector
const cssnitchExtension = new CSSnitchWebExtension();

// Listen for messages from popup and background script
if (typeof safari !== 'undefined' && safari.extension) {
  // Safari extension messaging
  safari.extension.addEventListener('message', (event) => {
    console.log('📥 Content script received Safari message:', event.name);
    if (event.name === 'toggle-inspector') {
      console.log('🎯 Content script: Toggling inspector');
      cssnitchExtension.toggleInspector();
    } else if (event.name === 'css-update') {
      // Handle CSS updates from Tauri app
      cssnitchExtension.applyCSSUpdate(event.message);
    }
  });
} else if (typeof browser !== 'undefined' && browser.runtime) {
  // Chrome/Firefox messaging
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggle-inspector') {
      cssnitchExtension.toggleInspector();
      sendResponse({ success: true });
    } else if (message.type === 'css-update') {
      // Handle CSS updates from Tauri app
      cssnitchExtension.applyCSSUpdate(message);
      sendResponse({ success: true });
    }
  });
}