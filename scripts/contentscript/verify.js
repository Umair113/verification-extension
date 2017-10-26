class VerifyDownload{
    constructor(window, document, $, conf){
        this.window = window;
        this.document = document;
        this.$ = $;
        this.conf = conf;
		this.extVersion = chrome.runtime.getManifest().version;
		console.log(this.extVersion);
		this.init();
    }
    init(){
		let self = this;
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
			self.sha256.update(chunk);
			offset += CHUNK_SIZE;
			self.readFile(file, offset, $fdfd)
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
			this.window.postMessage({ action: "verifying"}, "*");
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
}
let verify = new VerifyDownload(window, document, jQuery, conf);