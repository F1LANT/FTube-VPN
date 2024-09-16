const youtubeHosts = [
    "*.ytimg.com",
    "*.googlevideo.com"
  ];
  
  const vpnConfig = {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: "http",
        host: "176.124.221.71",
        port: 2509
      },
      bypassList: ["<local>"]
    }
  };
  
  let isEnabled = false;
  
  chrome.storage.sync.get('isEnabled', function(data) {
      isEnabled = data.isEnabled || false;
  });
  
  function shouldUseVPN(url) {
    const hostname = new URL(url).hostname;
    return youtubeHosts.some(host => 
      hostname === host || (host.startsWith("*") && hostname.endsWith(host.slice(1)))
    );
  }
  
  chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
      if (isEnabled && shouldUseVPN(details.url)) {
        chrome.proxy.settings.set({value: vpnConfig, scope: "regular"}, function() {});
      } else {
        chrome.proxy.settings.clear({scope: "regular"}, function() {});
      }
    },
    {urls: ["<all_urls>"]},
    ["blocking"]
  );
  
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.action === "toggleVPN") {
          isEnabled = request.isEnabled;
          chrome.storage.sync.set({isEnabled: isEnabled});
      }
  });