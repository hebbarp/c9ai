Object subclass: #C9AIRawConnector
	instanceVariableNames: 'serverUrl'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Raw'!

!C9AIRawConnector methodsFor: 'initialization'!
initialize
	super initialize.
	serverUrl := 'http://127.0.0.1:8080'! !

!C9AIRawConnector methodsFor: 'testing'!
testConnection
	"Test basic connection"
	| response |
	Transcript show: 'Testing connection to: ', serverUrl; cr.
	[response := HTTPSocket httpGet: serverUrl, '/health'.
	 Transcript show: 'Connection successful'; cr.
	 ^ true]
		on: Error
		do: [:ex | 
			Transcript show: 'Connection failed: ', ex messageText; cr.
			^ false]! !

!C9AIRawConnector methodsFor: 'api'!
sendRawPrompt: promptText
	"Try raw socket approach"
	| socket httpRequest response |
	Transcript show: 'Sending raw HTTP request for: ', promptText; cr.
	
	[socket := Socket newTCP.
	 socket connectTo: #[127 0 0 1] port: 8080.
	 socket waitForConnectionFor: 5.
	 
	 httpRequest := 'POST /completion HTTP/1.1', String cr,
	               'Host: 127.0.0.1:8080', String cr,
	               'Content-Type: application/json', String cr,
	               'Content-Length: ', ('{"prompt":"', promptText, '","max_tokens":20}') size printString, String cr,
	               String cr,
	               '{"prompt":"', promptText, '","max_tokens":20}'.
	 
	 socket sendData: httpRequest.
	 response := socket receiveData.
	 socket close.
	 
	 Transcript show: 'Raw response: ', response asString; cr.
	 ^ response]
		on: Error
		do: [:ex |
			Transcript show: 'Raw socket error: ', ex messageText; cr.
			^ 'Error']! !

!C9AIRawConnector class methodsFor: 'instance creation'!
new
	^ super new! !

!C9AIRawConnector class methodsFor: 'testing'!
testRaw
	"Test raw socket approach"
	| connector |
	connector := self new.
	connector testConnection.
	^ connector sendRawPrompt: 'Hello'! !