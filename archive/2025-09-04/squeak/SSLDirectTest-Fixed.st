!Object class methodsFor: 'testing'!
testSSLConnection
	"Direct SSL test with proper error handling"
	| socket address sslSocket data result |
	
	result := ''.
	
	[
		Transcript show: 'SSL Test: Creating socket...'; cr.
		socket := Socket new.
		address := NetNameResolver addressForName: 'api.openai.com' timeout: 10.
		socket connectTo: address port: 443.
		socket waitForConnectionFor: 10.
		
		Transcript show: 'SSL Test: TCP connected successfully'; cr.
		result := result, 'TCP Connection: SUCCESS', String cr.
		
		"Try SSL connection"
		sslSocket := SqueakSSL on: socket.
		Transcript show: 'SSL Test: SSL wrapper created'; cr.
		
		"Try different approaches to SSL connect"
		[
			Transcript show: 'SSL Test: Attempting SSL handshake...'; cr.
			sslSocket connect.
			Transcript show: 'SSL Test: SSL handshake SUCCESS!'; cr.
			result := result, 'SSL Handshake: SUCCESS', String cr.
			
			"Send HTTP request"
			Transcript show: 'SSL Test: Sending HTTPS request...'; cr.
			sslSocket sendData: 'GET / HTTP/1.1', String cr, 'Host: api.openai.com', String cr, 'Connection: close', String cr, String cr.
			
			"Try to receive data"
			data := ''.
			5 timesRepeat: [
				| chunk |
				[
					chunk := sslSocket receiveData.
					chunk ifNotNil: [
						chunk isEmpty ifFalse: [
							data := data, chunk.
							Transcript show: 'SSL Test: Received ', chunk size printString, ' bytes'; cr]].
				] on: Error do: [:ex |
					Transcript show: 'SSL Test: Receive attempt: ', ex messageText; cr]].
			
			data isEmpty ifFalse: [
				result := result, 'HTTPS Response: ', data size printString, ' bytes', String cr.
				result := result, 'Response content:', String cr, data, String cr.
				Transcript show: 'SSL Test: Total received: ', data size printString, ' bytes'; cr].
			
		] on: Error do: [:sslEx |
			Transcript show: 'SSL Test: SSL error: ', sslEx messageText; cr.
			result := result, 'SSL Error: ', sslEx messageText, String cr.
			
			"Try to get more details about the SSL error"
			[
				Transcript show: 'SSL Test: SSL State: ', sslSocket sslState printString; cr.
				result := result, 'SSL State: ', sslSocket sslState printString, String cr.
			] on: Error do: [:stateEx |
				Transcript show: 'SSL Test: Could not get SSL state: ', stateEx messageText; cr]].
		
		"Clean up"
		[sslSocket destroy] on: Error do: [:cleanEx |
			Transcript show: 'SSL Test: Cleanup error: ', cleanEx messageText; cr].
		socket close.
		
	] on: Error do: [:ex |
		Transcript show: 'SSL Test: Outer error: ', ex messageText; cr.
		result := result, 'Connection Error: ', ex messageText, String cr.
		socket ifNotNil: [socket close]].
	
	Transcript show: 'SSL Test: Complete'; cr.
	^ result! !