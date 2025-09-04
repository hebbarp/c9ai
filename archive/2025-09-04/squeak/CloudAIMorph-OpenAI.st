!CloudAIMorph methodsFor: 'testing'!
testOpenAI: queryText
	| socket address response data result chunkCount requestBody headers |
	
	result := 'OPENAI API TEST for: "', queryText, '"', String cr, String cr.
	response := String new.
	chunkCount := 0.
	
	[
		Transcript show: 'CloudAI: Testing OpenAI API...'; cr.
		
		socket := Socket new.
		address := NetNameResolver addressForName: 'api.openai.com' timeout: 10.
		socket connectTo: address port: 443.
		socket waitForConnectionFor: 10.
		
		result := result, 'Connection: SUCCESS', String cr.
		Transcript show: 'CloudAI: Connected successfully'; cr.
		
		"Build OpenAI API request"
		requestBody := '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"', queryText, '"}],"max_tokens":50}'.
		
		headers := 'POST /v1/chat/completions HTTP/1.1', String cr,
			'Host: api.openai.com', String cr,
			'Content-Type: application/json', String cr,
			'Authorization: Bearer YOUR_API_KEY_HERE', String cr,
			'User-Agent: SqueakCloudAI/1.0', String cr,
			'Content-Length: ', requestBody size printString, String cr,
			'Connection: close', String cr, String cr.
		
		Transcript show: 'CloudAI: Sending OpenAI API request...'; cr.
		socket sendData: headers, requestBody.
		
		"Read response - capture data before any errors"
		[
			"Get all data immediately available"
			[socket dataAvailable] whileTrue: [
				data := socket receiveData.
				data ifNotNil: [
					chunkCount := chunkCount + 1.
					Transcript show: 'CloudAI: Chunk #', chunkCount printString, ' - ', data size printString, ' bytes'; cr.
					response := response, data]].
			
			"Wait for more data"
			5 timesRepeat: [
				socket waitForDataFor: 2.
				socket dataAvailable ifTrue: [
					data := socket receiveData.
					data ifNotNil: [
						chunkCount := chunkCount + 1.
						Transcript show: 'CloudAI: Additional chunk #', chunkCount printString, ' - ', data size printString, ' bytes'; cr.
						response := response, data]]]
		] on: Error do: [:ex |
			Transcript show: 'CloudAI: Data reading completed (connection closed): ', ex messageText; cr].
		
		socket close.
		
		result := result, 'Response received: ', response size printString, ' bytes', String cr,
			'Total chunks: ', chunkCount printString, String cr, String cr.
		
		response size > 0 ifTrue: [
			result := result, 'OPENAI API RESPONSE:', String cr,
				'====================', String cr,
				response, String cr,
				'====================', String cr, String cr,
				'Response analysis:', String cr,
				'- HTTP Status: ', (self extractHTTPStatus: response), String cr,
				'- Contains "choices": ', (response includesSubstring: 'choices') printString, String cr,
				'- Contains "error": ', (response includesSubstring: 'error') printString, String cr,
				'- Content-Type: ', (self extractContentType: response), String cr]
		ifFalse: [
			result := result, 'NO RESPONSE CONTENT CAPTURED'].
		
		Transcript show: 'CloudAI: OpenAI API test completed - ', response size printString, ' bytes total'; cr.
		
	] on: Error do: [:ex |
		result := result, 'ERROR: ', ex messageText, String cr.
		response size > 0 ifTrue: [
			result := result, String cr, 'PARTIAL RESPONSE (', response size printString, ' bytes):', String cr,
				response].
		Transcript show: 'CloudAI: Error - ', ex messageText; cr.
		socket ifNotNil: [socket close]].
	
	^ result! !

!CloudAIMorph methodsFor: 'testing'!
extractHTTPStatus: response
	| statusLine |
	response ifEmpty: [^ 'No response'].
	statusLine := response copyFrom: 1 to: (response indexOf: Character cr) - 1.
	^ statusLine! !

!CloudAIMorph methodsFor: 'testing'!
extractContentType: response
	| startPos endPos |
	startPos := response findString: 'Content-Type: '.
	startPos = 0 ifTrue: [^ 'Not found'].
	startPos := startPos + 14.
	endPos := response indexOf: Character cr startingAt: startPos.
	endPos = 0 ifTrue: [^ 'Parse error'].
	^ response copyFrom: startPos to: endPos - 1! !