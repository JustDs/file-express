(function ($) {
	
	function dataChannelTest() {
		c1 = new Channel(function (message) {
			c2.receiveValidationMessage(message);
		});
		c1.start();
		c1.onstatechange = function () {
			console.log('c1: ' + c1.state);
			if(c1.state === 'ready') {
				var data = 'Hello!';
				c1.send(data);
				console.log('c1: send data "' + data + '"');
			}
		}
		c1.onreceive = function (data) {
			console.log('c1: received data "' + data + '"');
		}
		c2 = new Channel(function (message) {
			c1.receiveValidationMessage(message);
		});
		c2.onstatechange = function () {
			console.log('c2: ' + c2.state);
		}
		c2.onreceive = function (data) {
			console.log('c2: received data "' + data + '"');
		}
	}
	
	function splittableFileTest() {
		f1 = new SplittableFile(f);
		f2 = new SplittableFile();

		f1.split(100, function (segmentCount) {
			f2.setMetaInfo(f1.metaInfo);
			f2.startSplice(segmentCount);
		}, function (segment) {
			console.log(segment.content.length);
			f2.insertSegment(segment);
		});
	}

	$(document).ready(function () {
		dataChannelTest();

		var dropArea = document.getElementById('drop');

		dropArea.addEventListener('dragover', function (event) {
			event.dataTransfer.dropEffect = 'copy';
			event.stopPropagation();
			event.preventDefault();
			return false;
		}, false);

		dropArea.addEventListener('drop', function (event) {

			var files = event.dataTransfer.files;
			for (var index = 0; index < files.length; index++) {
				//console.log(files[index].slice());
				
				var fileSegment = files[index].slice(0, 500, 'application/octet-stream');//application/x-download
				f=files[index];
		splittableFileTest();

				var fileReader = new FileReader();
				fileReader.onloadend = function(event) {
					if (event.target.readyState == FileReader.DONE) {
						//console.log(event.target.result);
					}
				};
				fileReader.readAsBinaryString(fileSegment);
				
				//var url = URL.createObjectURL(fileSegment);
				//console.log(url);

				//c1.send(files[index]);
			};

			event.stopPropagation();
			event.preventDefault();
			return false;
		}, false);

		var handle = document.getElementById('handle');
		handle.addEventListener('dragstart', function (event) {
			event.dataTransfer.dropEffect = 'copy';
				console.log(event.dataTransfer);
			event.dataTransfer.setData('DownloadURL', [
				'application/octet-stream',
				f.name,
				URL.createObjectURL(f)
			].join(':'));
		}, false);





		//$.post('/', {index:0,content:'123'});
	});
})(jQuery);