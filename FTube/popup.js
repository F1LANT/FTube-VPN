let isEnabled = false;

document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleButton');
    
    chrome.storage.sync.get('isEnabled', function(data) {
        isEnabled = data.isEnabled || false;
        updateButtonText();
    });

    toggleButton.addEventListener('click', function() {
        isEnabled = !isEnabled;
        chrome.storage.sync.set({isEnabled: isEnabled});
        updateButtonText();
        chrome.runtime.sendMessage({action: "toggleVPN", isEnabled: isEnabled});
    });

    function updateButtonText() {
        toggleButton.textContent = isEnabled ? 'Выключить VPN' : 'Включить VPN';
    }
});