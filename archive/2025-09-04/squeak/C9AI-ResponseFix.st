Object subclass: #C9AILlamaClient
	instanceVariableNames: 'serverUrl'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Core'!

!C9AILlamaClient methodsFor: 'initialization'!
initialize
	super initialize.
	serverUrl := 'http://127.0.0.1:8080'! !

!C9AILlamaClient methodsFor: 'connection'!
testHealth
	"Test if llama.cpp server is responding"
	| response |
	Transcript show: 'Testing health at: ', serverUrl; cr.
	[response := HTTPSocket httpGet: serverUrl, '/health'.
	 Transcript show: 'Server is healthy'; cr.
	 ^ true]
		on: Error
		do: [:ex | 
			Transcript show: 'Health check failed: ', ex messageText; cr.
			^ false]! !

!C9AILlamaClient methodsFor: 'ai-api'!
completion: promptText
	"Send completion request to llama.cpp and extract text"
	| jsonBody response responseText |
	jsonBody := '{"prompt":"', promptText, '","max_tokens":100,"stream":false}'.
	
	Transcript show: 'Sending completion request...'; cr.
	
	[response := HTTPSocket 
		httpPost: serverUrl, '/completion'
		content: jsonBody
		type: 'application/json'
		accept: 'application/json'
		request: nil.
	 
	 "Extract text content from MIMEDocument"
	 responseText := response content.
	 Transcript show: 'Raw response: ', responseText; cr.
	 ^ responseText]
		on: Error
		do: [:ex |
			Transcript show: 'Completion error: ', ex messageText; cr.
			^ 'Error: ', ex messageText]! !

!C9AILlamaClient class methodsFor: 'instance creation'!
new
	^ super new! !

!C9AILlamaClient class methodsFor: 'demo'!
testResponse
	"Test response extraction"
	| client response |
	client := self new.
	response := client completion: 'Hello'.
	Transcript show: 'Final response: ', response; cr.
	^ response! !