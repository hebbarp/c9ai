!CloudAIMorph methodsFor: 'testing'!
testHTTP: queryText
	| socket address response data result chunkCount |
	
	result := 'HTTP CONNECTION TEST for: "', queryText, '"', String cr, String cr.
	response := String new.
	chunkCount := 0.
	
	[
		Transcript show: 'CloudAI: Testing HTTP connection...'; cr.
		
		socket := Socket new.
		address := NetNameResolver addressForName: 'api.openai.com' timeout: 10.
		socket connectTo: address port: 443.
		socket waitForConnectionFor: 10.
		
		result := result, 'Connection: SUCCESS', String cr.
		Transcript show: 'CloudAI: Connected successfully'; cr.
		
		"Send basic HTTP request"
		socket sendData: 'GET / HTTP/1.1', String cr, 'Host: api.openai.com', String cr, String cr.
		
		"Read response - capture data before any errors"
		[
			"Get all data immediately available"
			[socket dataAvailable] whileTrue: [
				data := socket receiveData.
				data ifNotNil: [
					chunkCount := chunkCount + 1.
					Transcript show: 'CloudAI: Chunk #', chunkCount printString, ' - ', data size printString, ' bytes'; cr.
					response := response, data]].
			
			"Wait a bit for any remaining data"
			3 timesRepeat: [
				socket waitForDataFor: 1.
				socket dataAvailable ifTrue: [
					data := socket receiveData.
					data ifNotNil: [
						chunkCount := chunkCount + 1.
						Transcript show: 'CloudAI: Additional chunk #', chunkCount printString, ' - ', data size printString, ' bytes'; cr.
						response := response, data]]]
		] on: Error do: [:ex |
			Transcript show: 'CloudAI: Data reading error (but we may have gotten data): ', ex messageText; cr].
		
		socket close.
		
		result := result, 'Response received: ', response size printString, ' bytes', String cr,
			'Total chunks: ', chunkCount printString, String cr, String cr.
		
		response size > 0 ifTrue: [
			result := result, 'COMPLETE RESPONSE CONTENT:', String cr,
				'============================', String cr,
				response, String cr,
				'============================', String cr, String cr,
				'First 100 chars: ', (response copyFrom: 1 to: (100 min: response size)), String cr,
				'Response analysis:', String cr,
				'- Starts with: ', (response copyFrom: 1 to: (20 min: response size)), String cr,
				'- Contains "HTTP": ', (response includesSubstring: 'HTTP') printString, String cr,
				'- Contains "404": ', (response includesSubstring: '404') printString, String cr,
				'- Contains "200": ', (response includesSubstring: '200') printString]
		ifFalse: [
			result := result, 'NO RESPONSE CONTENT CAPTURED'].
		
		Transcript show: 'CloudAI: Test completed - ', response size printString, ' bytes total'; cr.
		
	] on: Error do: [:ex |
		result := result, 'OUTER ERROR: ', ex messageText, String cr.
		"Still show any response we captured"
		response size > 0 ifTrue: [
			result := result, String cr, 'PARTIAL RESPONSE (', response size printString, ' bytes):', String cr,
				response].
		Transcript show: 'CloudAI: Outer error - ', ex messageText; cr.
		socket ifNotNil: [socket close]].
	
	^ result! !