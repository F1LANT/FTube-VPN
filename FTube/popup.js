document.addEventListener('DOMContentLoaded', function() {
    const vpnToggle = document.getElementById('vpnToggle');
    const vpnStatus = document.getElementById('vpnStatus');
    const proxyInfo = document.getElementById('proxyInfo');
    const speedInfo = document.getElementById('speedInfo');
    const sessionTrafficInfo = document.getElementById('sessionTrafficInfo');
    const totalTrafficInfo = document.getElementById('totalTrafficInfo');
    const sitesTab = document.getElementById('sitesTab');
    const proxyTab = document.getElementById('proxyTab');
    const sitesContent = document.getElementById('sitesContent');
    const proxyContent = document.getElementById('proxyContent');
    const siteList = document.getElementById('siteList');
    const proxyList = document.getElementById('proxyList');
    const newSite = document.getElementById('newSite');
    const addSite = document.getElementById('addSite');
    const proxyHost = document.getElementById('proxyHost');
    const proxyPort = document.getElementById('proxyPort');
    const proxyUsername = document.getElementById('proxyUsername');
    const proxyPassword = document.getElementById('proxyPassword');
    const addProxy = document.getElementById('addProxy');
    const exportSites = document.getElementById('exportSites');
    const importSites = document.getElementById('importSites');

    let currentSites = [];
    let currentProxyServers = [];
    let currentActiveProxyIndex = -1;

    function updateUI() {
        chrome.runtime.sendMessage({action: "getVPNStatus"}, function(response) {
            if (response) {
                vpnToggle.textContent = response.isEnabled ? 'Disable VPN' : 'Enable VPN';
                vpnToggle.classList.toggle('active', response.isEnabled);
                vpnStatus.textContent = response.isEnabled ? 'VPN is active' : 'VPN is inactive';
                proxyInfo.textContent = response.activeProxyIndex !== -1 && response.proxyServers[response.activeProxyIndex] 
                    ? `${response.proxyServers[response.activeProxyIndex].host}:${response.proxyServers[response.activeProxyIndex].port}` 
                    : 'Not set';
                speedInfo.textContent = `${response.speed.toFixed(2)} Mbps`;
                sessionTrafficInfo.textContent = `${response.sessionTraffic.toFixed(2)} MB`;
                totalTrafficInfo.textContent = `${response.totalTraffic.toFixed(2)} MB`;
                currentSites = response.sites;
                currentProxyServers = response.proxyServers;
                currentActiveProxyIndex = response.activeProxyIndex;
                updateSiteList();
                updateProxyList();
            }
        });
    }

    function updateSiteList() {
        siteList.innerHTML = '';
        currentSites.forEach(function(site) {
            const li = document.createElement('li');
            li.className = 'site-item';
            li.innerHTML = `
                <span>${site}</span>
                <button class="delete-btn">Delete</button>
            `;
            const deleteBtn = li.querySelector('.delete-btn');
            deleteBtn.onclick = function() {
                currentSites = currentSites.filter(s => s !== site);
                updateBackendSites();
            };
            siteList.appendChild(li);
        });
    }

    function updateProxyList() {
        proxyList.innerHTML = '';
        currentProxyServers.forEach(function(proxy, index) {
            const li = document.createElement('li');
            li.className = 'site-item';
            li.innerHTML = `
                <span>${proxy.host}:${proxy.port}</span>
                <button class="delete-btn">Delete</button>
                <button class="toggle-btn ${index === currentActiveProxyIndex ? 'active' : ''}">
                    ${index === currentActiveProxyIndex ? 'Deactivate' : 'Activate'}
                </button>
            `;
            const deleteBtn = li.querySelector('.delete-btn');
            deleteBtn.onclick = function() {
                currentProxyServers = currentProxyServers.filter((_, i) => i !== index);
                if (index === currentActiveProxyIndex) {
                    currentActiveProxyIndex = -1;
                } else if (index < currentActiveProxyIndex) {
                    currentActiveProxyIndex--;
                }
                updateBackendProxyServers();
            };
            const toggleBtn = li.querySelector('.toggle-btn');
            toggleBtn.onclick = function() {
                if (index === currentActiveProxyIndex) {
                    currentActiveProxyIndex = -1;
                } else {
                    currentActiveProxyIndex = index;
                }
                updateBackendProxyServers();
            };
            proxyList.appendChild(li);
        });
    }

    function updateBackendSites() {
        chrome.runtime.sendMessage({action: "updateSites", sites: currentSites}, function(response) {
            if (response && response.success) {
                updateUI();
            }
        });
    }

    function updateBackendProxyServers() {
        chrome.runtime.sendMessage({
            action: "updateProxyServers", 
            proxyServers: currentProxyServers,
            activeProxyIndex: currentActiveProxyIndex
        }, function(response) {
            if (response && response.success) {
                updateUI();
            }
        });
    }

    function formatSite(site) {
        try {
            if (!/^https?:\/\//i.test(site)) {
                site = 'http://' + site;
            }
            const urlObject = new URL(site);
            return urlObject.hostname;
        } catch (error) {
            console.error("Invalid URL:", site);
            return site;
        }
    }

    vpnToggle.addEventListener('click', function() {
        const newState = !vpnToggle.classList.contains('active');
        chrome.runtime.sendMessage({action: "toggleVPN", isEnabled: newState}, function(response) {
            if (response && response.success) {
                updateUI();
            }
        });
    });

    addSite.addEventListener('click', function() {
        const site = formatSite(newSite.value.trim());
        if (site && !currentSites.includes(site)) {
            currentSites.push(site);
            updateBackendSites();
            newSite.value = '';
        }
    });

    addProxy.addEventListener('click', function() {
        const host = proxyHost.value.trim();
        const port = proxyPort.value.trim();
        const username = proxyUsername.value.trim();
        const password = proxyPassword.value.trim();
        if (host && port) {
            currentProxyServers.push({host, port, username, password});
            updateBackendProxyServers();
            proxyHost.value = '';
            proxyPort.value = '';
            proxyUsername.value = '';
            proxyPassword.value = '';
        }
    });

    exportSites.addEventListener('click', function() {
        const blob = new Blob([JSON.stringify(currentSites)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ftube_vpn_sites.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    importSites.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedSites = JSON.parse(e.target.result);
                    if (Array.isArray(importedSites)) {
                        currentSites = [...new Set([...currentSites, ...importedSites.map(formatSite)])];
                        updateBackendSites();
                    }
                } catch (error) {
                    console.error("Error importing sites:", error);
                }
            };
            reader.readAsText(file);
        }
    });

    sitesTab.addEventListener('click', function() {
        sitesTab.classList.add('active');
        proxyTab.classList.remove('active');
        sitesContent.style.display = 'block';
        proxyContent.style.display = 'none';
    });

    proxyTab.addEventListener('click', function() {
        proxyTab.classList.add('active');
        sitesTab.classList.remove('active');
        proxyContent.style.display = 'block';
        sitesContent.style.display = 'none';
    });

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "updateTraffic") {
            sessionTrafficInfo.textContent = `${request.sessionTraffic.toFixed(2)} MB`;
            totalTrafficInfo.textContent = `${request.totalTraffic.toFixed(2)} MB`;
        } else if (request.action === "updateSpeed") {
            speedInfo.textContent = `${request.speed.toFixed(2)} Mbps`;
        }
    });

    updateUI();
    setInterval(updateUI, 1000);
});