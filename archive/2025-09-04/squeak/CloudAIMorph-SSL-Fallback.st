!CloudAIMorph methodsFor: 'api integration'!
queryCloudAI: queryText
	"Main cloud AI query method with SSL fallback"
	| result |
	
	result := ''.
	Transcript show: 'CloudAI: Starting query for: "', queryText, '"'; cr.
	
	"Try HTTPS first, fall back to alternative approaches"
	result := self tryHTTPSQuery: queryText.
	
	"If HTTPS failed completely, try HTTP test endpoint"
	(result includesSubstring: 'SSL Error') ifTrue: [
		Transcript show: 'CloudAI: HTTPS failed, trying HTTP fallback...'; cr.
		result := result, String cr, String cr, 'FALLBACK ATTEMPT:', String cr,
			(self tryHTTPFallback: queryText)].
	
	"If everything failed, provide helpful message"
	(result includesSubstring: 'ERROR') ifTrue: [
		result := result, String cr, String cr, 
			'CLOUD AI STATUS: SSL connection failed (code -5)', String cr,
			'This is common in Squeak SSL. Alternatives:', String cr,
			'1. Use HTTP proxy server for HTTPS requests', String cr,
			'2. Use local web browser automation', String cr,
			'3. Use curl/wget via OSProcess if available', String cr,
			'4. Mock responses for development'].
	
	^ result! !

!CloudAIMorph methodsFor: 'api integration'!
tryHTTPSQuery: queryText
	"Attempt HTTPS connection with proper SSL handling"
	| socket address sslSocket response result |
	
	result := 'HTTPS SSL Test Results:', String cr.
	response := ''.
	
	[
		"Create and connect socket"
		socket := Socket new.
		address := NetNameResolver addressForName: 'api.openai.com' timeout: 10.
		socket connectTo: address port: 443.
		socket waitForConnectionFor: 10.
		
		result := result, 'TCP Connection: SUCCESS', String cr.
		Transcript show: 'CloudAI: TCP connected to api.openai.com:443'; cr.
		
		"Try SSL connection with proper error handling"
		[
			sslSocket := SqueakSSL on: socket.
			Transcript show: 'CloudAI: SSL wrapper created'; cr.
			
			"Disable certificate checking for testing"
			sslSocket certificateVerificationMode: 0.
			Transcript show: 'CloudAI: Certificate checking disabled'; cr.
			
			"Attempt SSL handshake"
			sslSocket connect.
			
			result := result, 'SSL Handshake: SUCCESS', String cr.
			Transcript show: 'CloudAI: SSL handshake completed successfully'; cr.
			
			"Send simple GET request"
			sslSocket sendData: 'GET / HTTP/1.1', String cr, 
				'Host: api.openai.com', String cr,
				'Connection: close', String cr, String cr.
			
			"Try to read response"
			response := self readSSLResponse: sslSocket.
			result := result, 'Response Length: ', response size printString, ' bytes', String cr.
			
		] on: Error do: [:sslEx |
			result := result, 'SSL Error: ', sslEx messageText, String cr.
			Transcript show: 'CloudAI: SSL error: ', sslEx messageText; cr.
			
			"Try to get SSL state for debugging"
			[
				result := result, 'SSL State: ', sslSocket sslState printString, String cr.
			] on: Error do: [:stateEx |
				result := result, 'SSL State unavailable: ', stateEx messageText, String cr].
		].
		
		"Cleanup"
		[sslSocket ifNotNil: [sslSocket destroy]] on: Error do: [:ex | ].
		socket close.
		
	] on: Error do: [:ex |
		result := result, 'Connection Error: ', ex messageText, String cr.
		socket ifNotNil: [socket close]].
	
	"Add response content if we got any"
	response size > 0 ifTrue: [
		result := result, String cr, 'RESPONSE CONTENT:', String cr,
			'==================', String cr,
			response, String cr,
			'==================', String cr].
	
	^ result! !

!CloudAIMorph methodsFor: 'api integration'!
readSSLResponse: sslSocket
	"Read SSL response with proper error handling"
	| response data attempts |
	
	response := ''.
	attempts := 0.
	
	"Try multiple approaches to read data"
	[
		"Method 1: Direct receive with timeout"
		5 timesRepeat: [
			[
				data := sslSocket receiveData.
				data ifNotNil: [
					data isEmpty ifFalse: [
						response := response, data.
						Transcript show: 'CloudAI: Received ', data size printString, ' bytes'; cr]].
			] on: Error do: [:ex |
				Transcript show: 'CloudAI: Receive attempt failed: ', ex messageText; cr].
			
			(Delay forMilliseconds: 100) wait.
			attempts := attempts + 1].
		
		"Method 2: Check for available data"
		3 timesRepeat: [
			[
				(sslSocket dataAvailable) ifTrue: [
					data := sslSocket receiveData.
					data ifNotNil: [
						response := response, data.
						Transcript show: 'CloudAI: Additional data: ', data size printString, ' bytes'; cr]].
			] on: Error do: [:ex | ].
			(Delay forMilliseconds: 200) wait].
			
	] on: Error do: [:ex |
		Transcript show: 'CloudAI: Response reading completed with: ', ex messageText; cr].
	
	^ response! !

!CloudAIMorph methodsFor: 'api integration'!
tryHTTPFallback: queryText
	"Try HTTP connection as fallback (for testing connectivity)"
	| socket address response result |
	
	result := 'HTTP Fallback Test (httpbin.org):', String cr.
	response := ''.
	
	[
		socket := Socket new.
		address := NetNameResolver addressForName: 'httpbin.org' timeout: 10.
		socket connectTo: address port: 80.
		socket waitForConnectionFor: 10.
		
		result := result, 'HTTP Connection: SUCCESS', String cr.
		Transcript show: 'CloudAI: HTTP connected to httpbin.org'; cr.
		
		"Send simple HTTP request"
		socket sendData: 'GET /get HTTP/1.1', String cr,
			'Host: httpbin.org', String cr,
			'User-Agent: SqueakCloudAI', String cr,
			'Connection: close', String cr, String cr.
		
		"Read HTTP response"
		3 timesRepeat: [
			[
				| chunk |
				chunk := socket receiveData.
				chunk ifNotNil: [
					chunk isEmpty ifFalse: [
						response := response, chunk.
						Transcript show: 'CloudAI: HTTP chunk: ', chunk size printString, ' bytes'; cr]].
			] on: Error do: [:ex | ].
			(Delay forMilliseconds: 300) wait].
		
		socket close.
		
		result := result, 'HTTP Response: ', response size printString, ' bytes', String cr.
		
		"Analyze HTTP response"
		response size > 0 ifTrue: [
			result := result, 'HTTP Status: ', (self extractHTTPStatus: response), String cr,
				'Contains JSON: ', (response includesSubstring: '"url"') printString, String cr,
				String cr, 'First 200 chars:', String cr,
				(response copyFrom: 1 to: (response size min: 200)), String cr].
		
	] on: Error do: [:ex |
		result := result, 'HTTP Error: ', ex messageText, String cr.
		socket ifNotNil: [socket close]].
	
	^ result! !

!CloudAIMorph methodsFor: 'utilities'!
extractHTTPStatus: response
	"Extract HTTP status from response"
	| lines firstLine |
	
	response isEmpty ifTrue: [^ 'No response'].
	
	lines := response subStrings: String cr.
	lines isEmpty ifTrue: [^ 'No lines'].
	
	firstLine := lines first.
	(firstLine includesSubstring: 'HTTP/') ifTrue: [
		^ firstLine].
	
	^ 'Status not found'! !