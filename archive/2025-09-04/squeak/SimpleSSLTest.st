!Object class methodsFor: 'testing'!
simpleSSLTest
	| socket address sslSocket result |
	
	result := 'SSL Test Results:', String cr.
	
	[
		socket := Socket new.
		address := NetNameResolver addressForName: 'api.openai.com' timeout: 10.
		socket connectTo: address port: 443.
		socket waitForConnectionFor: 10.
		
		result := result, 'TCP Connection: OK', String cr.
		Transcript show: 'TCP connected'; cr.
		
		sslSocket := SqueakSSL on: socket.
		result := result, 'SSL Wrapper: OK', String cr.
		Transcript show: 'SSL wrapper created'; cr.
		
		[
			sslSocket connect.
			result := result, 'SSL Handshake: SUCCESS', String cr.
			Transcript show: 'SSL handshake worked!'; cr.
			
		] on: Error do: [:ex |
			result := result, 'SSL Error: ', ex messageText, String cr.
			Transcript show: 'SSL error: ', ex messageText; cr].
		
		sslSocket destroy.
		socket close.
		
	] on: Error do: [:ex |
		result := result, 'Connection Error: ', ex messageText, String cr.
		Transcript show: 'Connection error: ', ex messageText; cr.
		socket ifNotNil: [socket close]].
	
	^ result! !