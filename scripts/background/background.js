chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
	if (info.status === 'loading') {
		let matches = [
			"https://tails.boum.org/install/download_2/"
		];
		let js = [
			"scripts/vendor/jquery-3.2.1.js",
			"scripts/vendor/forge.min.js",
			"scripts/contentscript/conf.js",
			"scripts/contentscript/verify.js"
		];
		if(matches.indexOf(tab.url) > -1) {
			for(let i=0; i < js.length; i++){
				chrome.tabs.executeScript(tabId, {
					file: js[i],
					runAt: 'document_end'
				});
			}
		}
	}
});