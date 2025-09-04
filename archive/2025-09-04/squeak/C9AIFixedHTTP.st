Object subclass: #C9AIWorkingConnector
	instanceVariableNames: 'serverUrl'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Working'!

!C9AIWorkingConnector methodsFor: 'initialization'!
initialize
	super initialize.
	serverUrl := 'http://127.0.0.1:8080'! !

!C9AIWorkingConnector methodsFor: 'testing'!
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

!C9AIWorkingConnector methodsFor: 'api'!
sendPrompt: promptText
	"Send prompt using correct HTTPSocket method"
	| jsonBody response |
	jsonBody := '{"prompt":"', promptText, '","max_tokens":20,"stream":false}'.
	
	Transcript show: 'Sending prompt: ', promptText; cr.
	
	[response := HTTPSocket 
		httpPost: serverUrl, '/completion'
		content: jsonBody
		type: 'application/json'
		accept: 'application/json'
		request: nil.
	 Transcript show: 'Response: ', response asString; cr.
	 ^ response]
		on: Error
		do: [:ex |
			Transcript show: 'POST error: ', ex messageText; cr.
			^ 'Error: ', ex messageText]! !

!C9AIWorkingConnector class methodsFor: 'instance creation'!
new
	^ super new! !

!C9AIWorkingConnector class methodsFor: 'testing'!
testWorking
	"Test the working connector"
	| connector |
	connector := self new.
	connector testConnection.
	^ connector sendPrompt: 'Hello'! !