chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
	if (info.status === 'loading') {
		let matches =
				"://tails.boum.org/";
		let js = [
			"scripts/vendor/jquery-3.2.1.js",
			"scripts/vendor/forge.min.js",
			"scripts/contentscript/conf.js",
			"scripts/contentscript/verify.js"
		];
		if(tab.url.indexOf(matches) > -1) {
			for(let i=0; i < js.length; i++){
				chrome.tabs.executeScript(tabId, {
					file: js[i],
					runAt: 'document_end'
				});
			}
		}
	}
});

