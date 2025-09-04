!CloudAIMorph methodsFor: 'testing'!
testHTTP80: queryText
	| socket address response data result chunkCount headers |
	
	result := 'HTTP PORT 80 TEST for: "', queryText, '"', String cr, String cr.
	response := String new.
	chunkCount := 0.
	
	[
		Transcript show: 'CloudAI: Testing HTTP port 80...'; cr.
		
		socket := Socket new.
		address := NetNameResolver addressForName: 'api.openai.com' timeout: 10.
		socket connectTo: address port: 80.
		socket waitForConnectionFor: 10.
		
		result := result, 'HTTP Connection (port 80): SUCCESS', String cr.
		Transcript show: 'CloudAI: Connected to port 80 successfully'; cr.
		
		"Send HTTP request to port 80"
		headers := 'GET / HTTP/1.1', String cr,
			'Host: api.openai.com', String cr,
			'User-Agent: SqueakCloudAI/1.0', String cr,
			'Connection: close', String cr, String cr.
		
		Transcript show: 'CloudAI: Sending HTTP request to port 80...'; cr.
		socket sendData: headers.
		
		"Read response"
		[
			[socket dataAvailable] whileTrue: [
				data := socket receiveData.
				data ifNotNil: [
					chunkCount := chunkCount + 1.
					Transcript show: 'CloudAI: Chunk #', chunkCount printString, ' - ', data size printString, ' bytes'; cr.
					response := response, data]].
			
			5 timesRepeat: [
				socket waitForDataFor: 2.
				socket dataAvailable ifTrue: [
					data := socket receiveData.
					data ifNotNil: [
						chunkCount := chunkCount + 1.
						Transcript show: 'CloudAI: Additional chunk #', chunkCount printString, ' - ', data size printString, ' bytes'; cr.
						response := response, data]]]
		] on: Error do: [:ex |
			Transcript show: 'CloudAI: Data reading completed: ', ex messageText; cr].
		
		socket close.
		
		result := result, 'Response received: ', response size printString, ' bytes', String cr,
			'Total chunks: ', chunkCount printString, String cr, String cr.
		
		response size > 0 ifTrue: [
			result := result, 'HTTP PORT 80 RESPONSE:', String cr,
				'========================', String cr,
				response, String cr,
				'========================', String cr, String cr,
				'Analysis:', String cr,
				'- HTTP Status: ', (self extractHTTPStatus: response), String cr,
				'- Contains "301": ', (response includesSubstring: '301') printString, ' (redirect)', String cr,
				'- Contains "https": ', (response includesSubstring: 'https') printString, String cr,
				'- Contains "Location": ', (response includesSubstring: 'Location') printString, String cr,
				'- Different from port 443?: ', (response size ~= 316) printString]
		ifFalse: [
			result := result, 'NO RESPONSE CONTENT CAPTURED'].
		
		Transcript show: 'CloudAI: HTTP port 80 test completed - ', response size printString, ' bytes total'; cr.
		
	] on: Error do: [:ex |
		result := result, 'ERROR: ', ex messageText, String cr.
		response size > 0 ifTrue: [
			result := result, String cr, 'PARTIAL RESPONSE:', String cr, response].
		Transcript show: 'CloudAI: Error - ', ex messageText; cr.
		socket ifNotNil: [socket close]].
	
	^ result! !