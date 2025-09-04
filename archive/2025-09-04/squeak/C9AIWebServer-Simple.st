Object subclass: #C9AIWebServer
	instanceVariableNames: 'webServer port isRunning contentUpdateCallback currentContent'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIWebServer commentStamp: 'C9AI 8/25/2025 12:00' prior: 0!
Simple C9AI web server using Squeak's built-in WebServer.
Handles browser communication for interactive Unicode editing.

Usage:
  server := C9AIWebServer new.
  server onContentUpdate: [:newContent | "handle update here"].
  server start.!

!C9AIWebServer methodsFor: 'initialization'!
initialize
	super initialize.
	port := 7777.
	isRunning := false.
	currentContent := ''.
	contentUpdateCallback := [:content | 
		Transcript show: 'Content updated: ', content; cr]! !

!C9AIWebServer methodsFor: 'configuration'!
port: aPort
	port := aPort! !

!C9AIWebServer methodsFor: 'configuration'!
onContentUpdate: aBlock
	"Set callback for when browser sends content updates"
	contentUpdateCallback := aBlock! !

!C9AIWebServer methodsFor: 'content'!
currentContent: aString
	currentContent := aString! !

!C9AIWebServer methodsFor: 'content'!
currentContent
	^ currentContent! !

!C9AIWebServer methodsFor: 'server'!
start
	"Start the WebServer"
	isRunning ifTrue: [^ self].
	
	[webServer := WebServer new.
	 webServer listenOn: port.
	 
	 "Add our handlers"
	 webServer addService: '/update-content' action: [:request | self handleUpdateContent: request].
	 webServer addService: '/get-content' action: [:request | self handleGetContent: request].
	 
	 webServer start.
	 isRunning := true.
	 Transcript show: 'C9AI WebServer started on port ', port printString; cr]
		on: Error 
		do: [:ex |
			Transcript show: 'Failed to start WebServer: ', ex messageText; cr.
			isRunning := false]! !

!C9AIWebServer methodsFor: 'server'!
stop
	"Stop the WebServer"
	isRunning ifFalse: [^ self].
	
	[webServer ifNotNil: [
		webServer stop.
		webServer := nil.
	].
	 isRunning := false.
	 Transcript show: 'C9AI WebServer stopped'; cr]
		on: Error
		do: [:ex |
			Transcript show: 'Error stopping WebServer: ', ex messageText; cr]! !

!C9AIWebServer methodsFor: 'handlers'!
handleUpdateContent: request
	"Handle POST /update-content from browser"
	
	| content response |
	
	"Extract content from request"
	content := self extractContentFromRequest: request.
	content ifNotNil: [
		currentContent := content.
		contentUpdateCallback value: content.
	].
	
	"Build CORS response"
	response := WebResponse new.
	response status: 200.
	response headerAt: 'Access-Control-Allow-Origin' put: '*'.
	response headerAt: 'Access-Control-Allow-Methods' put: 'POST, GET, OPTIONS'.
	response headerAt: 'Access-Control-Allow-Headers' put: 'Content-Type'.
	response headerAt: 'Content-Type' put: 'application/json'.
	response content: '{"status": "success"}'.
	
	^ response! !

!C9AIWebServer methodsFor: 'handlers'!
handleGetContent: request
	"Handle GET /get-content from browser"
	
	| response jsonContent |
	
	jsonContent := '{"content": "', (self escapeJSON: currentContent), '"}'.
	
	response := WebResponse new.
	response status: 200.
	response headerAt: 'Access-Control-Allow-Origin' put: '*'.
	response headerAt: 'Content-Type' put: 'application/json'.
	response content: jsonContent.
	
	^ response! !

!C9AIWebServer methodsFor: 'helpers'!
extractContentFromRequest: request
	"Extract content from POST request"
	
	| body contentStart |
	
	body := request content.
	body ifNil: [^ nil].
	
	"Simple JSON parsing - find content field"
	contentStart := body findString: '"content":"'.
	contentStart = 0 ifTrue: [^ nil].
	
	^ self parseJSONContent: body startingAt: contentStart + '"content":"' size! !

!C9AIWebServer methodsFor: 'helpers'!
parseJSONContent: jsonString startingAt: startPos
	"Parse content from JSON string"
	
	| endPos content |
	
	"Find end of content (look for "," or "}")"
	endPos := jsonString findString: '","' startingAt: startPos.
	endPos = 0 ifTrue: [
		endPos := jsonString findString: '"}' startingAt: startPos.
	].
	endPos = 0 ifTrue: [^ nil].
	
	content := jsonString copyFrom: startPos to: endPos - 1.
	
	"Unescape JSON"
	content := content copyReplaceAll: '\"' with: '"'.
	content := content copyReplaceAll: '\\n' with: String cr.
	
	^ content! !

!C9AIWebServer methodsFor: 'helpers'!
escapeJSON: text
	"Escape text for JSON"
	
	| result |
	text ifNil: [^ ''].
	
	result := text copyReplaceAll: '"' with: '\"'.
	result := result copyReplaceAll: String cr with: '\\n'.
	result := result copyReplaceAll: String lf with: '\\n'.
	^ result! !

!C9AIWebServer methodsFor: 'communication'!
sendContentToBrowser: content
	"Send content to browser (for reload functionality)"
	currentContent := content! !

!C9AIWebServer class methodsFor: 'instance creation'!
new
	^ super new initialize! !

!C9AIWebServer class methodsFor: 'examples'!
example
	"Start WebServer for C9AI"
	| server |
	server := self new.
	server onContentUpdate: [:newContent |
		Transcript show: 'Browser updated: ', newContent; cr
	].
	server start.
	^ server! !

!C9AIWebServer class methodsFor: 'testing'!
test
	"Test the web server"
	| server |
	server := self example.
	server currentContent: 'Test content from Squeak'.
	Transcript show: 'WebServer test started. Try: http://localhost:7777/get-content'; cr.
	^ server! !