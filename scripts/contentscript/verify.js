class VerifyDownload{
    constructor(window, document, $, conf){
        this.window = window;
        this.document = document;
        this.$ = $;
        this.conf = conf;
		this.extVersion = chrome.runtime.getManifest().version;
		this.lastCalculatedPercentage = 0;
		console.log(this.extVersion);
		this.init();
    }
    init(){
		let self = this;

		this.showVerifyDownload();

		if(this.checkFileAPI()){
			this.fetchConf().done(()=>{
				self.setVerifyListener();
				self.initWindowMessageListener();
			}).fail(()=>{
				console.error('failed to get conf');
			});
		}
		else{
			console.error("FileReader api not supported");
		}
	}
	setVerifyListener(){
		let self = this;
		this.$(this.document).on("change", this.conf.verifySelector, (e) => {
			self.calculateHash(e.target);
		});
	}
	fetchConf(){
    	let $dfd = this.$.Deferred();
		let self = this;
		let rxs = {
			url: /\burl:\s*(https?:\/\/\S+)\b/,
			size: /\bsize:\s*(\d+)\b/,
			hash: /\bsha256:\s*([a-f0-9]{64})\b/,
			version: /\bversion:\s*['"]([0-9.]+)['"]/
		};
    	let ajaxData = {};
    	ajaxData.url= this.conf.descriptor;
    	this.$.ajax(ajaxData).done((data) =>{
			data = data.replace(/^[^'"]*#.*/gm, ''); // remove most comments
			let df = {};
			for (let p in rxs) {
				let m = data.match(rxs[p]);
				if (!m) return null;
				df[p] = m[1];
			}
			self.df = df;
			$dfd.resolve();
		}).fail(()=>{
    		$dfd.reject();
		});
    	return $dfd;
	}
    initWindowMessageListener(){
		let self = this;
		this.window.addEventListener("message", (event) => {
			if (event.source !== self.window){
				return;
			}
			if(!event.data || !event.data.method) {
				return;
			}
			if (!self[event.data.method]) {
				console.error('Method "' + event.data.method + '" does not exist');
				return;
			}
			event.data.args = event.data.args || [];
			self[event.data.method].apply(self, event.data.args || []);
		});
    }
	checkFileAPI() {
		return (this.window.File && this.window.FileReader && this.window.FileList && this.window.Blob);
	}
	readFile(file, offset, $fdfd){
		if (offset >= file.files[0].size) {
			$fdfd.resolve();
			return;
		}
		let self = this;
		let CHUNK_SIZE = 2 * 1024 *1024;
		let fr = new FileReader();
		fr.onload = e => {
			let chunk = e.target.result;
			let progressPercent = 0;
			self.sha256.update(chunk);
			offset += CHUNK_SIZE;
			progressPercent = parseInt((offset/file.files[0].size)*100);
			if (progressPercent>100) progressPercent = 100;
			if (!(progressPercent === this.lastCalculatedPercentage)){
				self.window.postMessage({ action: "progress",percentage : progressPercent}, "*");
				this.lastCalculatedPercentage = progressPercent;
			}

			self.readFile(file, offset, $fdfd);
		};
		fr.onerror = (e) => {
			console.error(e);
			$fdfd.reject();
		};
		let slice = file.files[0].slice(offset, offset + CHUNK_SIZE);
		fr.readAsBinaryString(slice);
		if(offset === 0){
			return $fdfd;
		}
	}
	calculateHash(filePath) {
		if(filePath.files && filePath.files[0]) {
			let self = this;
			this.window.postMessage({ action: "verifying",fileName:filePath.files[0].name}, "*");
			let fileSize = filePath.files[0].size;
			if(parseInt(this.df.size) !== fileSize) {
				console.error('File size does not match');
				this.window.postMessage({ action: "verification-failed"}, "*");
				return;
			}
			this.sha256 = forge.md.sha256.create();
			let startTime = new Date()/1;
			this.readFile(filePath, 0, this.$.Deferred()).done(()=>{
				let hash = this.sha256.digest().toHex();
				let endTime = new Date()/1;
				console.log(`Elapsed time : ${endTime-startTime}`);
				if(self.df.hash !== hash) {
					console.error('File hash does not match');
					self.window.postMessage({ action: "verification-failed"}, "*");
				}
				else{
					console.log('File is original');
					self.window.postMessage({ action: "verification-success"}, "*");
				}
			}).fail(()=>{
				console.error('Error reading file');
				self.window.postMessage({ action: "verification-failed"}, "*");
			});
		}
	}

	showVerifyDownload() {
    hide(document.getElementById('install-extension'));
    hide(document.getElementById('update-extension'));
    show(document.getElementById('verification'));
	}
}

function hide(elm) {
  elm.style.display = 'none';
}

function show(elm) {
  elm.style.display = 'initial';
  if(elm.classList.contains('block')) {
    elm.style.display = 'block';
  }
  if(elm.classList.contains('inline-block')) {
    elm.style.display = 'inline-block';
  }
}

function checkVersion() {

	function compareVersions(v1, v2) {
		if (v1 === v2) return 0;
		let [a, b] = [v1, v2].map(s => String(s).split("."));
		for (let j = 0, len = Math.max(a.length, b.length); j < len; j++) {
			let [x, y] = [a[j], b[j]].map(s => s || "0");
			let [n1, n2] = [x, y].map(s => parseInt(s, 10));
			if (n1 > n2) return 1;
			if (n1 < n2) return -1;
			[x, y] = [x, y].map(s => s.match(/[a-z].*/i));
			if (x || y) {
				if (x && y) return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0;
				return x ? -1 : 1;
			}
		}
		return 0;
	}

	var version = $("#extension-version").text();
	if (!version) return false;
	var extenVersion = chrome.runtime.getManifest();
	let versionCmp = compareVersions(extenVersion.version, version);
	let ok = versionCmp >= 0;
	document.documentElement.dataset.extension = ok ? "ok" : "old";
	return ok;
}


if ($('#install-extension').length >=1){
	if (!checkVersion()) {
		document.documentElement.removeAttribute("data-phase");
	}
	let verify = new VerifyDownload(window, document, jQuery, conf);
}

