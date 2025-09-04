!CloudAIMorph methodsFor: 'testing'!
testSSL: queryText
	| socket address sslSocket response data result chunkCount headers |
	
	result := 'SSL HTTPS TEST for: "', queryText, '"', String cr, String cr.
	response := String new.
	chunkCount := 0.
	
	[
		Transcript show: 'CloudAI: Testing SSL HTTPS connection...'; cr.
		
		"Create regular socket first"
		socket := Socket new.
		address := NetNameResolver addressForName: 'api.openai.com' timeout: 10.
		socket connectTo: address port: 443.
		socket waitForConnectionFor: 10.
		
		result := result, 'TCP Connection: SUCCESS', String cr.
		Transcript show: 'CloudAI: TCP connected successfully'; cr.
		
		"Try to wrap with SSL using correct API"
		sslSocket := nil.
		[
			"Use the correct SqueakSSL API"
			sslSocket := SqueakSSL new.
			Transcript show: 'CloudAI: SqueakSSL instance created, attempting SSL setup...'; cr.
			
			"Set up the SSL connection"
			sslSocket socket: socket.
			sslSocket connect.
			
			result := result, 'SSL Handshake: SUCCESS', String cr.
			Transcript show: 'CloudAI: SSL handshake completed'; cr.
			
		] on: Error do: [:ex |
			result := result, 'SSL Error: ', ex messageText, String cr.
			Transcript show: 'CloudAI: SSL failed: ', ex messageText, '; using plain socket'; cr.
			sslSocket := socket].
		
		"Build simple HTTPS GET request"
		headers := 'GET / HTTP/1.1', String cr,
			'Host: api.openai.com', String cr,
			'User-Agent: SqueakCloudAI/1.0', String cr,
			'Connection: close', String cr, String cr.
		
		Transcript show: 'CloudAI: Sending HTTPS request...'; cr.
		sslSocket sendData: headers.
		
		"Read response"
		[
			[sslSocket dataAvailable] whileTrue: [
				data := sslSocket receiveData.
				data ifNotNil: [
					chunkCount := chunkCount + 1.
					Transcript show: 'CloudAI: Chunk #', chunkCount printString, ' - ', data size printString, ' bytes'; cr.
					response := response, data]].
			
			5 timesRepeat: [
				sslSocket waitForDataFor: 2.
				sslSocket dataAvailable ifTrue: [
					data := sslSocket receiveData.
					data ifNotNil: [
						chunkCount := chunkCount + 1.
						Transcript show: 'CloudAI: Additional chunk #', chunkCount printString, ' - ', data size printString, ' bytes'; cr.
						response := response, data]]]
		] on: Error do: [:ex |
			Transcript show: 'CloudAI: Data reading completed: ', ex messageText; cr].
		
		sslSocket close.
		
		result := result, 'Response received: ', response size printString, ' bytes', String cr,
			'Total chunks: ', chunkCount printString, String cr, String cr.
		
		response size > 0 ifTrue: [
			result := result, 'HTTPS RESPONSE:', String cr,
				'================', String cr,
				response, String cr,
				'================', String cr, String cr,
				'Analysis:', String cr,
				'- HTTP Status: ', (self extractHTTPStatus: response), String cr,
				'- Server: ', (self extractServer: response), String cr,
				'- Different from Cloudflare 400?: ', (response size ~= 316) printString, String cr,
				'- Contains "OpenAI": ', (response includesSubstring: 'OpenAI') printString]
		ifFalse: [
			result := result, 'NO RESPONSE CONTENT CAPTURED'].
		
		Transcript show: 'CloudAI: SSL test completed - ', response size printString, ' bytes total'; cr.
		
	] on: Error do: [:ex |
		result := result, 'ERROR: ', ex messageText, String cr.
		response size > 0 ifTrue: [
			result := result, String cr, 'PARTIAL RESPONSE:', String cr, response].
		Transcript show: 'CloudAI: Error - ', ex messageText; cr.
		sslSocket ifNotNil: [sslSocket close].
		socket ifNotNil: [socket close]].
	
	^ result! !