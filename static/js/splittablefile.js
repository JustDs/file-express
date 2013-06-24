
/**
 * 可分割的文件模型,基于Blob,用于分片传输
 */

var SplittableFile = (function () {

	/**
	 * 文件片段模型
	 */
	function FileSegment(index, content) {

		/**
		 * 文件片段序号
		 */
		this.index = index;
		
		/**
		 * 文件片段内容,字符串或Blob
		 */
		this.content = content;
	}

	/**
	 * 可分割的文件模型
	 */
	function FileMetaInfo(options) {

		// 创建指定长度的十六进制字串
		function RandomHexString(size) {
			var hexString = '';
			for (var n = 0; n < size / 8; n++) {
				hexString += Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1);
			};
			return hexString.substring(0, size);
		}

		this.id = options.id || RandomHexString(32);
		this.name = options.name || 'Unamed-' + this.id;
		this.size = options.size || 0;
		this.type = options.type || 'application/octet-stream';
	}

	/**
	 * 可分割的文件模型
	 */
	function SplittableFile(originalFile) {
		var file = this;

		// 从现有文件创建可分割的文件
		if (originalFile && originalFile.constructor === File) {
			file.blob = originalFile;
			file.metaInfo = new FileMetaInfo({
				name: originalFile.name,
				size: originalFile.size,
				type: originalFile.type
			});
			file.state = 'completed';
			if (file.onstatechange) channel.onstatechange({ }); // TODO: 改成Event的形式
		}

		file.__segmentCount = 0;
		file.__blobTable = { };
	}

	SplittableFile.prototype = {

		/**
		 * 重置构造函数
		 */
		constructor: SplittableFile,

		/**
		 * 文件元信息,包括文件名,大小,类型等
		 */
		metaInfo: null,

		/**
		 * 存放文件数据的Blob
		 */
		blob: null,

		/**
		 * 文件状态:
		 *  'empty' - 空白文件
		 *  'ready' - 准备开始拼接整合文件
		 *  'completing' - 正在拼接整合文件
		 *  'completed' - 拼接整合完成
		 */
		state: 'empty',

		/**
		 * 文件状态发生变化时触发该句柄
		 */
		onstatechange: null, // TODO: 整理一下文件分割拼接的流程,在某些特定的时间点进行回调以控制文件传输的进度

		/**
		 * 分割文件并打包成json以进行传输
		 */
		split: function (size, onsplitstart, onsplit) {
			var file = this;

			if (size > 0) {
// TODO: 分成两部分
				// 分割开始时回调onsplitstart句柄,提供片段数量信息
				if(onsplitstart) onsplitstart(Math.ceil(file.metaInfo.size / size));

				for (var index = 0; index * size < file.metaInfo.size; index++) {

					// 使用闭包以保证回调后的index值不会出错
					(function (index) {

						// 对文件进行分割
						var newSegment = file.blob.slice(
							index * size,
							(index + 1) * size < file.metaInfo.size ? (index + 1) * size : file.metaInfo.size,
							'application/octet-stream;charset=UTF-8'
						);
						file.__segmentCount++;

						// 通过FileReader读取文件片段
						var fileReader = new FileReader();
						fileReader.onloadend = function(event) {
							if (event.target.readyState == FileReader.DONE) {
// TODO: 此处上传文件夹会出错
								// 每进行一次分割调用一次回调函数
								if(onsplit && event.target.result) onsplit(new FileSegment(index, event.target.result));
							}
						};
						fileReader.readAsBinaryString(newSegment);
					})(index);
				}
			}
		},

		/**
		 * 设置文件元信息
		 */
		setMetaInfo: function (metaInfo) {
			var file = this;

			// 当文件状态为空文件时允许设置元信息
			if (file.state === 'empty' && metaInfo && metaInfo.constructor === FileMetaInfo) {

				file.metaInfo = metaInfo;

				// 设置文件状态为准备开始拼接整合文件
				file.state = 'ready';
				if (file.onstatechange) channel.onstatechange({ }); // TODO: 改成Event的形式
			}
		},

		/**
		 * 开视拼接整合文件
		 */
		startSplice: function (segmentCount) {
			var file = this;

			// 当文件状态为准备就绪时允许开视拼接整合文件
			if (file.state === 'ready' && segmentCount >= 0) {

				file.__segmentCount = segmentCount;

				// 设置文件状态为拼接整合中
				file.state = 'completing';
				if (file.onstatechange) channel.onstatechange({ }); // TODO: 改成Event的形式

				// 若为空文件则直接设置文件状态为已完成
				if (segmentCount === 0 || file.metaInfo.size === 0) {
					file.state = 'completed';
					if (file.onstatechange) channel.onstatechange({ }); // TODO: 改成Event的形式
				}
			}
		},

		/**
		 * 向文件插入片段
		 */
		insertSegment: function (segment) {
			var file = this;
			var blobTable = this.__blobTable;
			var segmentCount = this.__segmentCount;

			// 当文件状态为拼接整合中时允许插入片段
			if (file.state === 'completing') {

				var insertIndex = segment.index;
				var insertBlob = new Blob([segment.content]);

				// 插入片段前后无现存片段
				if (!blobTable[insertIndex - 1] && !blobTable[insertIndex + 1]) {
					blobTable[insertIndex] = {
						correspondingIndex: insertIndex,
						blob: insertBlob
					};
				} else {
					var newBlob = null;
					var newStartIndex = null;
					var newEndIndex = null;

					// 插入片段前后均有现存片段
					if (blobTable[insertIndex - 1] && blobTable[insertIndex + 1]) {
						newBlob = new Blob([
							blobTable[insertIndex - 1].blob,
							insertBlob,
							blobTable[insertIndex + 1].blob
						]);
						newStartIndex = blobTable[insertIndex - 1].correspondingIndex;
						newEndIndex = blobTable[insertIndex - 1].correspondingIndex;
					} else {
						// 插入片段前有现存片段
						if (blobTable[insertIndex - 1]) {
							newBlob = new Blob([
								blobTable[insertIndex - 1].blob,
								insertBlob
							]);
							newStartIndex = blobTable[insertIndex - 1].correspondingIndex;
							newEndIndex = insertIndex;
						}
						// 插入片段后有现存片段
						if (blobTable[insertIndex + 1]) {
							newBlob = new Blob([
								insertBlob,
								blobTable[insertIndex + 1].blob
							]);
							newStartIndex = insertIndex;
							newEndIndex = blobTable[insertIndex - 1].correspondingIndex;
						}
					}

					// 清除连接前插入位置前后的片段
					if (blobTable[insertIndex - 1]) {
						//delete blobTable[insertIndex - 1].blob;
						delete blobTable[insertIndex - 1];
					}
					if (blobTable[insertIndex + 1]) {
						//delete blobTable[insertIndex + 1].blob;
						delete blobTable[insertIndex + 1];
					}

					// 插入连接后的的片段
					blobTable[newStartIndex] = {
						correspondingIndex: newEndIndex,
						blob: newBlob
					};
					blobTable[newEndIndex] = {
						correspondingIndex: newStartIndex,
						blob: newBlob
					};

					//delete insertBlob;
				}

				// 拼接整合完成
				if (blobTable[0] && blobTable[0].correspondingIndex === segmentCount - 1) {
					//if (file.blob) delete file.blob;
					file.blob = blobTable[0].blob;
					delete blobTable[0];
					delete blobTable[segmentCount - 1];
					file.state = 'completed';
					if (file.onstatechange) channel.onstatechange({ }); // TODO: 改成Event的形式

					// TODO: 拼接完成后文件长度可能发生变化,疑似汉字造成的问题
				}
			}
		}
	}

	return SplittableFile;

})();