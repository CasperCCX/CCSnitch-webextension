// CSSnitch Popup Script
console.log('🔘 Popup script loaded!');
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔘 Popup DOM loaded!');
    const toggleButton = document.getElementById('toggleInspector');
    const openAppButton = document.getElementById('openTauriApp');
    const statusDiv = document.getElementById('status');
    
    // Check if we're on a development site
    if (typeof safari !== 'undefined' && safari.extension) {
        // Safari extension - get current tab info differently
        const currentURL = window.location.href;
        try {
            // For Safari extensions, we'll assume it's a dev site for now
            // In a real implementation, you'd get the active tab URL through Safari's API
            statusDiv.className = 'status dev';
            statusDiv.textContent = '✅ Ready to inspect (Safari extension)';
            toggleButton.disabled = false;
        } catch (error) {
            statusDiv.className = 'status prod';
            statusDiv.textContent = '⚠️ Only works on development sites';
            toggleButton.disabled = true;
        }
    } else if (typeof browser !== 'undefined' && browser.tabs) {
        // Other browsers
        browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const tab = tabs[0];
            const url = new URL(tab.url);
            
            if (isDevelopmentSite(url)) {
                statusDiv.className = 'status dev';
                statusDiv.textContent = '✅ Development site detected';
                toggleButton.disabled = false;
            } else {
                statusDiv.className = 'status prod';
                statusDiv.textContent = '⚠️ Only works on development sites (localhost, .dev, etc.)';
                toggleButton.disabled = true;
                toggleButton.textContent = '🚫 Not Available';
            }
        });
    }
    
    // Toggle inspector
    toggleButton.addEventListener('click', function() {
        console.log('🔘 Popup: Start Inspecting button clicked');
        if (typeof safari !== 'undefined' && safari.extension) {
            // Safari extension
            console.log('🔘 Popup: Sending toggle-inspector message via Safari');
            safari.extension.dispatchMessage('toggle-inspector');
            window.close();
        } else if (typeof browser !== 'undefined' && browser.tabs) {
            // Other browsers
            browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
                browser.tabs.sendMessage(tabs[0].id, {action: 'toggle-inspector'}, function(response) {
                    if (response && response.success) {
                        window.close();
                    }
                });
            });
        }
    });
    
    // Open Tauri app (placeholder)
    openAppButton.addEventListener('click', function() {
        // This would ideally launch the Tauri app
        // For now, just show a message
        alert('Make sure your CSSnitch Tauri app is running!\n\nRun: npx tauri dev');
    });
    
    function isDevelopmentSite(url) {
        const hostname = url.hostname;
        return hostname === 'localhost' ||
               hostname === '127.0.0.1' ||
               hostname.endsWith('.local') ||
               hostname.endsWith('.dev') ||
               url.port !== '';
    }
});