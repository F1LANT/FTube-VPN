document.addEventListener('DOMContentLoaded', function() {
    const vpnToggle = document.getElementById('vpnToggle');
    const vpnStatus = document.getElementById('vpnStatus');
    const proxyInfo = document.getElementById('proxyInfo');
    const speedInfo = document.getElementById('speedInfo');
    const sessionTrafficInfo = document.getElementById('sessionTrafficInfo');
    const totalTrafficInfo = document.getElementById('totalTrafficInfo');
    const sitesTab = document.getElementById('sitesTab');
    const settingsTab = document.getElementById('settingsTab');
    const sitesContent = document.getElementById('sitesContent');
    const settingsContent = document.getElementById('settingsContent');
    const siteList = document.getElementById('siteList');
    const newSite = document.getElementById('newSite');
    const addSite = document.getElementById('addSite');
    const proxyHost = document.getElementById('proxyHost');
    const proxyPort = document.getElementById('proxyPort');
    const proxyUsername = document.getElementById('proxyUsername');
    const proxyPassword = document.getElementById('proxyPassword');
    const saveProxySettings = document.getElementById('saveProxySettings');

    function updateUI() {
        console.log("Обновление UI");
        chrome.runtime.sendMessage({action: "getVPNStatus"}, function(response) {
            console.log("Получен статус VPN:", response);
            if (response) {
                updateVpnButton(response.isEnabled);
                vpnStatus.textContent = response.isEnabled ? 'VPN активен' : 'VPN неактивен';
                proxyInfo.textContent = response.proxySettings ? `${response.proxySettings.host}:${response.proxySettings.port}` : 'Не установлен';
                speedInfo.textContent = `${response.speed.toFixed(2)} Mbps`;
                sessionTrafficInfo.textContent = `${response.sessionTraffic.toFixed(2)} MB`;
                totalTrafficInfo.textContent = `${response.totalTraffic.toFixed(2)} MB`;
                updateSiteList(response.sites);

                if (response.proxySettings) {
                    proxyHost.value = response.proxySettings.host || '';
                    proxyPort.value = response.proxySettings.port || '';
                    proxyUsername.value = response.proxySettings.username || '';
                    proxyPassword.value = response.proxySettings.password || '';
                }
            }
        });
    }

    function updateVpnButton(isEnabled) {
        if (isEnabled) {
            vpnToggle.textContent = 'Выключить VPN';
            vpnToggle.classList.add('active');
        } else {
            vpnToggle.textContent = 'Включить VPN';
            vpnToggle.classList.remove('active');
        }
    }

    vpnToggle.addEventListener('click', function() {
        console.log("Переключение VPN");
        const newState = !vpnToggle.classList.contains('active');
        chrome.runtime.sendMessage({action: "toggleVPN", isEnabled: newState}, function(response) {
            console.log("Ответ на переключение VPN:", response);
            if (response && response.success) {
                updateVpnButton(newState);
                updateUI();
            } else {
                console.error("Ошибка при переключении VPN");
            }
        });
    });

    addSite.addEventListener('click', function() {
        const site = newSite.value.trim();
        console.log("Добавление сайта:", site);
        if (site) {
            chrome.runtime.sendMessage({action: "getVPNStatus"}, function(response) {
                const sites = response.sites || [];
                if (!sites.includes(site)) {
                    sites.push(site);
                    chrome.runtime.sendMessage({action: "updateSites", sites: sites}, function(response) {
                        console.log("Ответ на обновление списка сайтов:", response);
                        if (response && response.success) {
                            updateUI();
                            newSite.value = '';
                        }
                    });
                }
            });
        }
    });

    saveProxySettings.addEventListener('click', function() {
        const settings = {
            host: proxyHost.value,
            port: proxyPort.value,
            username: proxyUsername.value,
            password: proxyPassword.value
        };
        console.log("Сохранение настроек прокси:", settings);
        chrome.runtime.sendMessage({action: "updateProxySettings", settings: settings}, function(response) {
            console.log("Ответ на обновление настроек прокси:", response);
            if (response && response.success) {
                alert('Настройки прокси успешно обновлены.');
                updateUI();
            } else {
                alert('Произошла ошибка при обновлении настроек прокси.');
            }
        });
    });

    function updateSiteList(sites) {
        console.log("Обновление списка сайтов:", sites);
        siteList.innerHTML = '';
        sites.forEach(function(site) {
            const li = document.createElement('li');
            li.className = 'site-item';
            li.innerHTML = `
                <span>${site}</span>
                <button class="delete-btn">Удалить</button>
            `;
            const deleteBtn = li.querySelector('.delete-btn');
            deleteBtn.onclick = function() {
                const updatedSites = sites.filter(s => s !== site);
                chrome.runtime.sendMessage({action: "updateSites", sites: updatedSites}, function(response) {
                    console.log("Ответ на удаление сайта:", response);
                    if (response && response.success) {
                        updateUI();
                    }
                });
            };
            siteList.appendChild(li);
        });
    }

    sitesTab.addEventListener('click', function() {
        sitesTab.classList.add('active');
        settingsTab.classList.remove('active');
        sitesContent.style.display = 'block';
        settingsContent.style.display = 'none';
    });

    settingsTab.addEventListener('click', function() {
        settingsTab.classList.add('active');
        sitesTab.classList.remove('active');
        settingsContent.style.display = 'block';
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