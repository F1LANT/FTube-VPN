let isEnabled = false;
let sites = [];
let proxySettings = null;
let totalTraffic = 0;
let sessionTraffic = 0;
let lastRequestTime = Date.now();
let requestsInLastSecond = 0;
let bytesInLastSecond = 0;

function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['isEnabled', 'sites', 'proxySettings', 'totalTraffic'], function(data) {
            console.log("Загруженные данные:", data);
            isEnabled = data.isEnabled || false;
            sites = data.sites || [];
            proxySettings = data.proxySettings || null;
            totalTraffic = data.totalTraffic || 0;
            resolve();
        });
    });
}

function saveSettings() {
    return new Promise((resolve) => {
        const data = { isEnabled, sites, proxySettings, totalTraffic };
        chrome.storage.local.set(data, function() {
            console.log("Данные сохранены:", data);
            resolve();
        });
    });
}

function generatePacScript() {
    const sitePatterns = sites.map(site => `shExpMatch(url, "*://*.${site}/*") || shExpMatch(url, "*://${site}/*")`).join(' || ');
    return `
        function FindProxyForURL(url, host) {
            if (${sitePatterns}) {
                return "PROXY ${proxySettings.host}:${proxySettings.port}";
            }
            return "DIRECT";
        }
    `;
}

async function updateProxySettings() {
    if (isEnabled && proxySettings && sites.length > 0) {
        const pacScript = generatePacScript();
        const config = {
            mode: "pac_script",
            pacScript: {
                data: pacScript
            }
        };

        try {
            await chrome.proxy.settings.set({value: config, scope: "regular"});
            console.log("PAC script успешно установлен");
        } catch (error) {
            console.error("Ошибка при установке PAC script:", error);
        }
    } else {
        try {
            await chrome.proxy.settings.clear({scope: "regular"});
            console.log("Настройки прокси очищены");
        } catch (error) {
            console.error("Ошибка при очистке настроек прокси:", error);
        }
    }
}

chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        if (isEnabled && sites.some(site => details.url.includes(site))) {
            const now = Date.now();
            if (now - lastRequestTime >= 1000) {
                // Прошла секунда, обновляем скорость
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
            // Примерный подсчет трафика на основе размера запроса и ответа
            const requestSize = details.requestHeaders ? JSON.stringify(details.requestHeaders).length : 0;
            const responseSize = details.responseHeaders ? JSON.stringify(details.responseHeaders).length : 0;
            const estimatedSize = requestSize + responseSize + 1024; // Добавляем 1KB как примерную оценку тела ответа

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
    {urls: ["<all_urls>"]},
    ["responseHeaders"]
);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("Получено сообщение:", request);
    switch (request.action) {
        case "toggleVPN":
            isEnabled = request.isEnabled;
            console.log("Переключение VPN. Новое состояние:", isEnabled);
            saveSettings().then(updateProxySettings).then(() => {
                sendResponse({success: true});
            });
            return true;
        case "updateSites":
            sites = request.sites;
            console.log("Обновление списка сайтов:", sites);
            saveSettings().then(updateProxySettings).then(() => {
                sendResponse({success: true});
            });
            return true;
        case "updateProxySettings":
            proxySettings = request.settings;
            console.log("Обновление настроек прокси:", proxySettings);
            saveSettings().then(updateProxySettings).then(() => {
                sendResponse({success: true});
            });
            return true;
        case "getVPNStatus":
            console.log("Запрос статуса VPN");
            sendResponse({
                isEnabled: isEnabled,
                proxySettings: proxySettings,
                totalTraffic: totalTraffic / (1024 * 1024), // в MB
                sessionTraffic: sessionTraffic / (1024 * 1024), // в MB
                speed: (bytesInLastSecond * 8) / (1024 * 1024), // в Mbps
                sites: sites
            });
            return true;
    }
});

chrome.proxy.onProxyError.addListener(function(details) {
    console.error("Ошибка прокси:", JSON.stringify(details));
});

// Загрузка настроек при запуске
loadSettings().then(updateProxySettings);

// Сохранение настроек каждые 5 минут
setInterval(saveSettings, 1 * 60 * 1000);