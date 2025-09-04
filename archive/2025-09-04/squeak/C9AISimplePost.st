Object subclass: #C9AISimpleConnector
	instanceVariableNames: 'serverUrl'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Simple'!

!C9AISimpleConnector methodsFor: 'initialization'!
initialize
	super initialize.
	serverUrl := 'http://127.0.0.1:8080'! !

!C9AISimpleConnector methodsFor: 'testing'!
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

!C9AISimpleConnector methodsFor: 'api'!
sendPromptSimple: promptText
	"Send prompt using basic HTTP"
	| socket response |
	Transcript show: 'Attempting to send: ', promptText; cr.
	
	[socket := HTTPSocket new.
	 response := socket httpPost: serverUrl, '/completion' 
	                    content: '{"prompt":"', promptText, '","max_tokens":20}'
	                    type: 'application/json'.
	 Transcript show: 'Got response: ', response asString; cr.
	 ^ response]
		on: Error
		do: [:ex |
			Transcript show: 'POST error: ', ex messageText; cr.
			^ 'Error']! !

!C9AISimpleConnector class methodsFor: 'instance creation'!
new
	^ super new! !

!C9AISimpleConnector class methodsFor: 'testing'!
testPost
	"Test POST request"
	| connector |
	connector := self new.
	connector testConnection.
	^ connector sendPromptSimple: 'Hi'! !