Object subclass: #C9AILlamaConnector
	instanceVariableNames: 'serverUrl httpClient'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Core'!

!C9AILlamaConnector commentStamp: 'C9AI 8/24/2025 08:00' prior: 0!
Connector for llama.cpp server running on localhost:8080
Handles HTTP communication with the local AI model server.!

!C9AILlamaConnector methodsFor: 'initialization' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
initialize
	super initialize.
	serverUrl := 'http://127.0.0.1:8080'.
	httpClient := HTTPSocket new! !

!C9AILlamaConnector methodsFor: 'api-calls' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
healthCheck
	"Test if llama.cpp server is responding"
	| response |
	[response := self httpGet: '/health'.
	 response isNil ifTrue: [^ false].
	 ^ true]
		on: Error
		do: [:ex | ^ false]! !

!C9AILlamaConnector methodsFor: 'api-calls' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
sendPrompt: promptText
	"Send a prompt to llama.cpp and return the response"
	| requestBody response |
	requestBody := '{
		"prompt": "', promptText, '",
		"max_tokens": 150,
		"temperature": 0.7,
		"stream": false
	}'.
	
	response := self httpPost: '/completion' body: requestBody.
	^ self parseCompletionResponse: response! !

!C9AILlamaConnector methodsFor: 'http-utils' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
httpGet: endpoint
	"Perform HTTP GET request"
	| url response |
	url := serverUrl, endpoint.
	
	[response := HTTPSocket httpGet: url.
	 ^ response]
		on: Error
		do: [:ex | 
			Transcript show: 'HTTP GET Error: ', ex messageText; cr.
			^ nil]! !

!C9AILlamaConnector methodsFor: 'http-utils' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
httpPost: endpoint body: jsonBody
	"Perform HTTP POST request with JSON body"
	| url response |
	url := serverUrl, endpoint.
	
	[response := HTTPSocket 
		httpPost: url
		content: jsonBody
		type: 'application/json'.
	 ^ response]
		on: Error
		do: [:ex | 
			Transcript show: 'HTTP POST Error: ', ex messageText; cr.
			^ nil]! !

!C9AILlamaConnector methodsFor: 'parsing' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
parseCompletionResponse: jsonResponse
	"Parse llama.cpp completion response"
	| json content |
	jsonResponse isNil ifTrue: [^ 'Error: No response from server'].
	
	[json := Json readFrom: jsonResponse readStream.
	 content := json at: 'content' ifAbsent: ['No content in response'].
	 ^ content]
		on: Error
		do: [:ex | ^ 'Error parsing response: ', ex messageText]! !

"Class side methods"
!C9AILlamaConnector class methodsFor: 'instance creation' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
new
	^ super new! !

!C9AILlamaConnector class methodsFor: 'testing' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
test
	"Test the llama.cpp connection"
	| connector result |
	connector := self new.
	
	Transcript show: 'Testing llama.cpp connection...'; cr.
	
	"Test health check"
	(connector healthCheck)
		ifTrue: [Transcript show: '✓ Health check passed'; cr]
		ifFalse: [Transcript show: '✗ Health check failed'; cr. ^ false].
	
	"Test prompt"
	result := connector sendPrompt: 'Hello, how are you?'.
	Transcript show: 'Response: ', result; cr.
	
	^ true! !