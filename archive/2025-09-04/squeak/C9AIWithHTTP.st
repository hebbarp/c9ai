Object subclass: #C9AIHTTPConnector
	instanceVariableNames: 'serverUrl'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-HTTP'!

!C9AIHTTPConnector methodsFor: 'initialization'!
initialize
	super initialize.
	serverUrl := 'http://127.0.0.1:8080'! !

!C9AIHTTPConnector methodsFor: 'testing'!
testConnection
	"Test basic connection to llama.cpp server"
	| response |
	Transcript show: 'Testing connection to: ', serverUrl; cr.
	[response := HTTPSocket httpGet: serverUrl, '/health'.
	 Transcript show: 'Connection successful'; cr.
	 ^ true]
		on: Error
		do: [:ex | 
			Transcript show: 'Connection failed: ', ex messageText; cr.
			^ false]! !

!C9AIHTTPConnector methodsFor: 'api'!
sendSimplePrompt: promptText
	"Send a simple prompt to llama.cpp"
	| jsonBody response |
	jsonBody := '{"prompt":"', promptText, '","max_tokens":50,"stream":false}'.
	
	Transcript show: 'Sending prompt: ', promptText; cr.
	
	[response := HTTPSocket 
		httpPost: serverUrl, '/completion' 
		content: jsonBody 
		type: 'application/json'.
	 Transcript show: 'Response received: ', response; cr.
	 ^ response]
		on: Error
		do: [:ex |
			Transcript show: 'Error sending prompt: ', ex messageText; cr.
			^ 'Error: ', ex messageText]! !

!C9AIHTTPConnector class methodsFor: 'instance creation'!
new
	^ super new! !

!C9AIHTTPConnector class methodsFor: 'testing'!
test
	"Test the HTTP connector"
	| connector |
	connector := self new.
	connector testConnection.
	^ connector sendSimplePrompt: 'Hello AI'! !