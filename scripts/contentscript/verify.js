class VerifyDownload{
    constructor(window, document, $, conf){
        this.window = window;
        this.document = document;
        this.$ = $;
        this.conf = conf;
		this.init();
    }
    init(){
    	this.fetchConf().done(()=>{
			if(this.checkFileAPI()){
				this.initWindowMessageListener();
			}
			else{
				console.error("FileReader api not supported");
			}
		}).fail(()=>{
    		console.error('failed to get conf');
		});
	}
	fetchConf(){
    	let $dfd = this.$.Deferred();
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
			this.df = df;
			$dfd.resolve();
		}).fail(()=>{
    		$dfd.reject();
		});
    	return $dfd;
	}
    initWindowMessageListener(){
		this.window.addEventListener("message", (event) => {
			if (event.source !== this.window || !event.data){
				return;
			}
			if (!this[event.data.method]) {
				console.error('Method "' + event.data.method + '" does not exist');
			}
			event.data.args = event.data.args || [];
			this[event.data.method].apply(this, event.data.args || []);
		});
    }
	checkFileAPI() {
		if (this.window.File && this.window.FileReader && this.window.FileList && this.window.Blob) {
			this.reader = new FileReader();
			return true;
		} else {
			return false;
		}
	}
	calculateHash(filePath) {
		if(filePath.files && filePath.files[0]) {
			let fileSize = filePath.files[0].size;
			if(this.df.size !== fileSize) {
				console.error('file size does not match');
				return;
			}
			this.reader.onload = (e) => {
				let file = e.target.result;			//https://github.com/Caligatio/jsSHA
				let sha256 = new jsSHA('SHA-256', 'TEXT'); //HEX, TEXT, B64, BYTES, or ARRAYBUFFER
				sha256.update(file);
				let hash = sha256.getHash("HEX");
				if(this.df.hash !== hash) {
					console.error('file hash does not match');
				}
			};
			this.reader.readAsText(filePath.files[0]);
		}
	}
}
let verify = new VerifyDownload(window, document, jQuery, conf);