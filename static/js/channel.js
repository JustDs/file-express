
/**
 * WebRTC数据信道封装
 */

var Channel = (function () {

	// 浏览器适配
	var RTCPeerConnection =
		window.webkitRTCPeerConnection ||
		window.mozRTCPeerConnection ||
		window.RTCPeerConnection;

	var RTCSessionDescription =
		window.webkitRTCSessionDescription || 
		window.mozRTCSessionDescription ||
		window.RTCSessionDescription;

	var RTCIceCandidate =
		window.webkitRTCIceCandidate || 
		window.mozRTCIceCandidate ||
		window.RTCIceCandidate;

	if (!RTCPeerConnection || !RTCSessionDescription || !RTCIceCandidate) {
		console.error('WebRTC not supported.');
		return null;
	}

	/**
	 * 验证信息模型
	 */
	function validationMessage(type, content) {

		/**
		 * 验证信息类型
		 *  'candidate' - WebRTC的candidate信息
		 *  'offer' - 请求建立连接
		 *  'answer' - 应答建立连接
		 *  'close' - 关闭连接
		 */
		this.type = type;

		/**
		 * 验证信息内容
		 */
		if (content) this.content = content;
	}

	/**
	 * 信道模型
	 */
	function Channel(sendValidationMessage) {

		var channel = this;
		this.__connection = null;
		this.__dataChannel = null;
		this.__sendValidationMessage = sendValidationMessage;

		// 设置DataChannel的事件句柄
		channel.__setDataChannelEventHandler = function () {
			var dataChannel = channel.__dataChannel;

			// DataChannel开启时触发,修改信道状态为'ready'
			dataChannel.onopen = function (event) {
				channel.state = 'ready';
				if(channel.onstatechange) channel.onstatechange({ }); // TODO: 改成Event的形式
			};
			
			// DataChannel关闭时触发,修改信道状态为'closed'
			dataChannel.onclose = function (event) {
				channel.state = 'closed';
				if(channel.onstatechange) channel.onstatechange({ }); // TODO: 改成Event的形式
			};

			// DataChannel收到信息时触发
			dataChannel.onmessage = function (event) {
				if (event.data) {
					if(channel.onreceive) channel.onreceive(event.data); // TODO: 改成Event的形式
				}
			};
		}

		// 关闭并重置连接
		channel.__resetConnection = function () {

			// 若有现存的连接则将之关闭并删除
			if (channel.__connection) {
				channel.__dataChannel.close();
				channel.__connection.close();
			}
			channel.__dataChannel = null;
			channel.__connection = null;

			// 创建PeerConnection
			var connection = new RTCPeerConnection(
				{ iceServers: [{ url: 'stun:stun.l.google.com:19302' }] },
				{ optional: [{ RtpDataChannels: true }] }
			);

			// 需要发送candidate信息时触发,通过sendValidationMessage方法发送
			// ps: 其实我真心不知道candidate是啥意思..T_T
			connection.onicecandidate = function (event) {
				if (event.candidate) {
					var message = new validationMessage('candidate', event.candidate);
					sendValidationMessage(message);
				}
			};

			// 当对方向连接添加DataChannel时触发
			connection.ondatachannel = function (event) {
				var dataChannel = event.channel;

				if (dataChannel) {
					// 设置本地DataChannel
					channel.__dataChannel = dataChannel;

					// 设置DataChannel的事件句柄
					channel.__setDataChannelEventHandler();
				}
			};

			channel.__connection = connection;
		}

		// 初始化连接
		channel.__resetConnection();
	}

	Channel.prototype = {

		/**
		 * 重置构造函数
		 */
		constructor: Channel,

		/**
		 * 信道当前状态:
		 *  'closed' - 已关闭或尚未开启
		 *  'establishing' - 正在建立中
		 *  'ready' - 已建立
		 *  'closing' - 正在关闭
		 *  'error' - 发生错误已中断
		 */
		state: 'closed',

		/**
		 * 信道状态发生变化时触发该句柄
		 */
		onstatechange: null,

		/**
		 * 通过信道收到数据时触发该句柄
		 */
		onreceive: null,

		/**
		 * 启动信道,仅在状态为'closed'或'error'时生效
		 */
		start: function () {
			var channel = this;
			var connection = this.__connection;
			var dataChannel = this.__dataChannel;
			var sendValidationMessage = this.__sendValidationMessage;

			if (channel.state === 'closed' || channel.state === 'error') {

				// 修改信道状态为'establishing'
				channel.state = 'establishing';
				if (channel.onstatechange) channel.onstatechange({ }); // TODO: 改成Event的形式

				// 如果没有建立DataChannel则创建DataChannel
				if (!dataChannel) {
					dataChannel = connection.createDataChannel('defaultDataChannel', { reliable: false });
					channel.__dataChannel = dataChannel;
				}

				// 设置DataChannel的事件句柄
				channel.__setDataChannelEventHandler();

				// 作出连接请求
				connection.createOffer(
					// 成功时的回调函数
					function (description) {
						// 更新本地信息
						connection.setLocalDescription(description);

						// 向远程发送开启连接请求
						if (description) {
							var message = new validationMessage('offer', description);
							sendValidationMessage(message);
						}
					},
					// 出错时的回调函数
					function (error) {
						// 关闭并重置连接
						channel.__resetConnection();

						// 修改信道状态为'error'
						channel.state = 'error';
						if(channel.onstatechange) channel.onstatechange({ error: error }); // TODO: 改成Event的形式
					}
				);
			}
		},

		/**
		 * 关闭信道,仅在状态为'ready'或'establishing'时生效
		 */
		stop: function () {
			var channel = this;
			var connection = this.__connection;
			var dataChannel = this.__dataChannel;
			var sendValidationMessage = this.__sendValidationMessage;

			if (channel.state === 'ready' || channel.state === 'establishing') {

				// 修改信道状态为'closing'
				channel.state = 'closing';
				if(channel.onstatechange) channel.onstatechange({ }); // TODO: 改成Event的形式

				// 向远程发送关闭连接请求
				var message = new validationMessage('close');
				sendValidationMessage(message);

				// 关闭并重置连接
				channel.__resetConnection();
			}
		},

		/**
		 * 对验证消息进行处理,以完成验证过程
		 * 收到建立信道所需验证消息时应从外部调用该函数
		 */
		receiveValidationMessage: function (message) {
			var channel = this;
			var connection = this.__connection;
			var dataChannel = this.__dataChannel;
			var sendValidationMessage = this.__sendValidationMessage;

			if (message) {

				// 对验证信息进行分类处理
				switch (message.type) {

					// 验证信息为candidate信息
					case 'candidate':
						if (message.content) {
							// 在本地进行添加
							var candidate = new RTCIceCandidate(message.content);
							connection.addIceCandidate(candidate);
						}
						break;

					// 验证信息为请求端发出的描述符信息
					case 'offer':
						if (message.content) {
							// 修改信道状态为'establishing'
							channel.state = 'establishing';
							if(channel.onstatechange) channel.onstatechange({ }); // TODO: 改成Event的形式

							// 更新本地信息
							var remoteDescription = new RTCSessionDescription(message.content);
							connection.setRemoteDescription(remoteDescription);

							// 作出应答
							connection.createAnswer(
								// 成功时的回调函数
								function (description) {
									connection.setLocalDescription(description);
									if (description) {
										var message = new validationMessage('answer', description);
										sendValidationMessage(message);
									}
								},
								// 出错时的回调函数
								function (error) {
									// 关闭并重置连接
									channel.__resetConnection();

									// 修改信道状态为'error'
									channel.state = 'error';
									if(channel.onstatechange) channel.onstatechange({ error: error }); // TODO: 改成Event的形式
								}
							);
						}
						break;

					// 验证信息为应答端发出的描述符信息
					case 'answer':
						if (message.content) {
							// 更新本地信息
							var remoteDescription = new RTCSessionDescription(message.content);
							connection.setRemoteDescription(remoteDescription);
						}
						break;

					// 验证信息为关闭连接请求
					case 'close':
						// 修改信道状态为'closing'
						channel.state = 'closing';
						if(channel.onstatechange) channel.onstatechange({ }); // TODO: 改成Event的形式

						// 关闭并重置连接
						channel.__resetConnection();
						break;
				}
			}
		},

		/**
		 * 通过信道发送数据
		 */
		send: function (data) {
			var channel = this;
			var dataChannel = this.__dataChannel;

			// 发送数据
			dataChannel.send(data);
		}
	}

	return Channel;

})();