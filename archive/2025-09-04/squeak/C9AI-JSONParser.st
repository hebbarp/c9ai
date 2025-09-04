Object subclass: #C9AILlamaClient
	instanceVariableNames: 'serverUrl'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Core'!

!C9AILlamaClient methodsFor: 'initialization'!
initialize
	super initialize.
	serverUrl := 'http://127.0.0.1:8080'! !

!C9AILlamaClient methodsFor: 'ai-api'!
completion: promptText
	"Send completion request and parse JSON response"
	| jsonBody response responseText jsonData content |
	jsonBody := '{"prompt":"', promptText, '","max_tokens":150,"stream":false}'.
	
	Transcript show: 'Sending: ', promptText; cr.
	
	[response := HTTPSocket 
		httpPost: serverUrl, '/completion'
		content: jsonBody
		type: 'application/json'
		accept: 'application/json'
		request: nil.
	 
	 responseText := response content.
	 
	 "Try to parse JSON and extract content field"
	 [jsonData := Json readFrom: responseText readStream.
	  content := jsonData at: 'content' ifAbsent: [responseText].
	  ^ content]
		on: Error
		do: [:parseEx | 
			Transcript show: 'JSON parse error, returning raw: ', parseEx messageText; cr.
			^ responseText]]
		on: Error
		do: [:ex |
			Transcript show: 'HTTP error: ', ex messageText; cr.
			^ 'Connection Error: ', ex messageText]! !

!C9AILlamaClient class methodsFor: 'instance creation'!
new
	^ super new! !

!C9AILlamaClient class methodsFor: 'demo'!
testCleanResponse
	"Test clean response parsing"
	| client response |
	client := self new.
	response := client completion: 'What is 2+2?'.
	Transcript show: 'Clean response: ', response; cr.
	^ response! !