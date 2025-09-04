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
		[
			"Use the correct SqueakSSL API - on: creates SSL wrapper"
			sslSocket := SqueakSSL on: socket.
			Transcript show: 'CloudAI: SqueakSSL wrapper created, attempting SSL handshake...'; cr.
			
			"Perform SSL handshake"
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
		
		"Read response with proper SSL methods"
		[
			"Try to read data using SSL receiveData"
			10 timesRepeat: [
				[
					data := sslSocket receiveData.
					data ifNotNil: [data isEmpty ifFalse: [
						chunkCount := chunkCount + 1.
						Transcript show: 'CloudAI: SSL Chunk #', chunkCount printString, ' - ', data size printString, ' bytes'; cr.
						response := response, data]].
				] on: Error do: [:readEx |
					Transcript show: 'CloudAI: SSL read attempt failed: ', readEx messageText; cr].
				
				"Wait a bit between attempts"
				(Delay forMilliseconds: 200) wait].
		] on: Error do: [:ex |
			Transcript show: 'CloudAI: SSL data reading completed: ', ex messageText; cr].
		
		"Clean up SSL connection"
		[sslSocket destroy] on: Error do: [:ex | 
			Transcript show: 'CloudAI: SSL cleanup: ', ex messageText; cr].
		socket close.
		
		result := result, 'Response received: ', response size printString, ' bytes', String cr,
			'Total chunks: ', chunkCount printString, String cr, String cr.
		
		response size > 0 ifTrue: [
			result := result, 'HTTPS SSL RESPONSE:', String cr,
				'=====================', String cr,
				response, String cr,
				'=====================', String cr, String cr,
				'Analysis:', String cr,
				'- HTTP Status: ', (self extractHTTPStatus: response), String cr,
				'- Server: ', (self extractServer: response), String cr,
				'- Response size vs Cloudflare: ', response size printString, ' vs 316', String cr,
				'- SSL Success?: ', (response size > 316) printString, String cr,
				'- Contains "OpenAI": ', (response includesSubstring: 'OpenAI') printString]
		ifFalse: [
			result := result, 'NO RESPONSE CONTENT CAPTURED - SSL may have failed'].
		
		Transcript show: 'CloudAI: SSL test completed - ', response size printString, ' bytes total'; cr.
		
	] on: Error do: [:ex |
		result := result, 'OUTER ERROR: ', ex messageText, String cr.
		response size > 0 ifTrue: [
			result := result, String cr, 'PARTIAL RESPONSE:', String cr, response].
		Transcript show: 'CloudAI: Outer error - ', ex messageText; cr.
		socket ifNotNil: [socket close]].
	
	^ result! !