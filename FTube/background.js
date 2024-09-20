let isEnabled = false;
let sites = [];
let proxyServers = [];
let activeProxyIndex = -1;
let totalTraffic = 0;
let sessionTraffic = 0;
let lastRequestTime = Date.now();
let requestsInLastSecond = 0;
let bytesInLastSecond = 0;

function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['isEnabled', 'sites', 'proxyServers', 'activeProxyIndex', 'totalTraffic'], function(data) {
            console.log("Loaded data:", data);
            isEnabled = data.isEnabled || false;
            sites = data.sites || [];
            proxyServers = data.proxyServers || [];
            activeProxyIndex = data.activeProxyIndex || -1;
            totalTraffic = data.totalTraffic || 0;
            resolve();
        });
    });
}

function saveSettings() {
    return new Promise((resolve) => {
        const data = { isEnabled, sites, proxyServers, activeProxyIndex, totalTraffic };
        chrome.storage.local.set(data, function() {
            console.log("Data saved:", data);
            resolve();
        });
    });
}

function generatePacScript() {
    if (activeProxyIndex === -1 || !proxyServers[activeProxyIndex]) {
        return 'function FindProxyForURL(url, host) { return "DIRECT"; }';
    }

    const activeProxy = proxyServers[activeProxyIndex];
    const sitePatterns = sites.map(site => `shExpMatch(url, "*://*.${site}/*") || shExpMatch(url, "*://${site}/*")`).join(' || ');
    
    return `
        function FindProxyForURL(url, host) {
            if (${sitePatterns}) {
                return "PROXY ${activeProxy.host}:${activeProxy.port}";
            }
            return "DIRECT";
        }
    `;
}

async function updateProxySettings() {
    if (isEnabled && activeProxyIndex !== -1 && proxyServers[activeProxyIndex] && sites.length > 0) {
        const pacScript = generatePacScript();
        const config = {
            mode: "pac_script",
            pacScript: {
                data: pacScript
            }
        };

        try {
            await chrome.proxy.settings.set({value: config, scope: "regular"});
            console.log("PAC script successfully set");
        } catch (error) {
            console.error("Error setting PAC script:", error);
        }
    } else {
        try {
            await chrome.proxy.settings.clear({scope: "regular"});
            console.log("Proxy settings cleared");
        } catch (error) {
            console.error("Error clearing proxy settings:", error);
        }
    }
}

chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        if (isEnabled && sites.some(site => details.url.includes(site))) {
            const now = Date.now();
            if (now - lastRequestTime >= 1000) {
                const speed = (bytesInLastSecond * 8) / (1024 * 1024); // Mbps
                chrome.runtime.sendMessage({action: "updateSpeed", speed: speed});
                requestsInLastSecond = 0;
                bytesInLastSecond = 0;
                lastRequestTime = now;
            }
            requestsInLastSecond++;
        }
    },
    {urls: ["<all_urls>"]}
);

chrome.webRequest.onCompleted.addListener(
    function(details) {
        if (isEnabled && sites.some(site => details.url.includes(site))) {
            const estimatedSize = details.responseSize || 1024; // Use responseSize if available, otherwise estimate

            totalTraffic += estimatedSize;
            sessionTraffic += estimatedSize;
            bytesInLastSecond += estimatedSize;

            chrome.runtime.sendMessage({
                action: "updateTraffic", 
                totalTraffic: totalTraffic / (1024 * 1024), 
                sessionTraffic: sessionTraffic / (1024 * 1024)
            });

            saveSettings();
        }
    },
    {urls: ["<all_urls>"]}
);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("Message received:", request);
    switch (request.action) {
        case "toggleVPN":
            isEnabled = request.isEnabled;
            console.log("VPN toggled. New state:", isEnabled);
            saveSettings().then(updateProxySettings).then(() => {
                sendResponse({success: true});
            });
            return true;
        case "updateSites":
            sites = request.sites;
            console.log("Sites list updated:", sites);
            saveSettings().then(updateProxySettings).then(() => {
                sendResponse({success: true});
            });
            return true;
        case "updateProxyServers":
            proxyServers = request.proxyServers;
            activeProxyIndex = request.activeProxyIndex;
            console.log("Proxy servers updated:", proxyServers);
            console.log("Active proxy index:", activeProxyIndex);
            saveSettings().then(updateProxySettings).then(() => {
                sendResponse({success: true});
            });
            return true;
        case "getVPNStatus":
            console.log("VPN status requested");
            sendResponse({
                isEnabled: isEnabled,
                proxyServers: proxyServers,
                activeProxyIndex: activeProxyIndex,
                totalTraffic: totalTraffic / (1024 * 1024), // in MB
                sessionTraffic: sessionTraffic / (1024 * 1024), // in MB
                speed: (bytesInLastSecond * 8) / (1024 * 1024), // in Mbps
                sites: sites
            });
            return true;
    }
});

chrome.proxy.onProxyError.addListener(function(details) {
    console.error("Proxy error:", JSON.stringify(details));
});

// Load settings on startup
loadSettings().then(updateProxySettings);

// Save settings every 5 minutes
setInterval(saveSettings, 5 * 60 * 1000);