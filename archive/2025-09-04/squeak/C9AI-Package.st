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
	"Send completion request to llama.cpp"
	| jsonBody response |
	jsonBody := '{"prompt":"', promptText, '","max_tokens":50,"stream":false}'.
	
	Transcript show: 'Sending completion request...'; cr.
	
	[response := HTTPSocket 
		httpPost: serverUrl, '/completion'
		content: jsonBody
		type: 'application/json'
		accept: 'application/json'
		request: nil.
	 Transcript show: 'Completion response received'; cr.
	 ^ response]
		on: Error
		do: [:ex |
			Transcript show: 'Completion error: ', ex messageText; cr.
			^ nil]! !

!C9AILlamaClient class methodsFor: 'instance creation'!
new
	^ super new! !

!C9AILlamaClient class methodsFor: 'demo'!
quickTest
	"Quick test of the C9AI system"
	| client |
	Transcript show: '=== C9AI Quick Test ==='; cr.
	client := self new.
	client testHealth.
	client completion: 'Say hello'.
	Transcript show: '=== Test Complete ==='; cr! !