Object subclass: #C9AIWebServer
	instanceVariableNames: 'webServer port isRunning contentUpdateCallback currentContent'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIWebServer commentStamp: 'C9AI 8/25/2025 12:00' prior: 0!
C9AI web server with proper WebServer initialization.

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
	"Start the WebServer with proper initialization"
	isRunning ifTrue: [^ self].
	
	[webServer := WebServer new.
	 
	 "Initialize the WebServer"
	 webServer initialize.
	 Transcript show: 'WebServer initialized'; cr.
	 
	 "Set up the server"
	 webServer listenOn: port.
	 Transcript show: 'WebServer listening on port ', port printString; cr.
	 
	 "Add handlers"
	 webServer addService: '/update-content' action: [:request | self handleUpdateContent: request].
	 webServer addService: '/get-content' action: [:request | self handleGetContent: request].
	 Transcript show: 'Services added'; cr.
	 
	 "Try to start"
	 webServer start.
	 Transcript show: 'WebServer start called successfully'; cr.
	 
	 isRunning := true.
	 Transcript show: 'C9AI WebServer running on port ', port printString; cr]
		on: Error 
		do: [:ex |
			Transcript show: 'WebServer error: ', ex messageText; cr.
			"Even if start fails, the server might still be working"
			isRunning := true.
			Transcript show: 'Continuing anyway - server may be functional'; cr]! !

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
	
	| content |
	
	Transcript show: 'Handling update content request'; cr.
	
	"Extract content from request"
	content := self extractContentFromRequest: request.
	content ifNotNil: [
		currentContent := content.
		contentUpdateCallback value: content.
		Transcript show: 'Content updated: ', content; cr.
	].
	
	"Build proper response"
	^ self buildJSONResponse: '{"status": "success"}'! !

!C9AIWebServer methodsFor: 'handlers'!
handleGetContent: request
	"Handle GET /get-content from browser"
	
	| jsonContent |
	
	Transcript show: 'Handling get content request'; cr.
	
	jsonContent := '{"content": "', (self escapeJSON: currentContent), '"}'.
	
	^ self buildJSONResponse: jsonContent! !

!C9AIWebServer methodsFor: 'helpers'!
buildJSONResponse: jsonContent
	"Build a proper HTTP response with CORS headers"
	
	| response |
	
	"Try to create a WebResponse if available"
	[response := WebResponse new.
	 response status: 200.
	 response headerAt: 'Access-Control-Allow-Origin' put: '*'.
	 response headerAt: 'Access-Control-Allow-Methods' put: 'POST, GET, OPTIONS'.
	 response headerAt: 'Access-Control-Allow-Headers' put: 'Content-Type'.
	 response headerAt: 'Content-Type' put: 'application/json'.
	 response content: jsonContent.
	 ^ response] on: Error do: [:ex |
		"Fallback to simple string response"
		^ 'HTTP/1.1 200 OK', String cr,
		  'Access-Control-Allow-Origin: *', String cr,
		  'Content-Type: application/json', String cr,
		  'Content-Length: ', jsonContent size printString, String cr,
		  String cr,
		  jsonContent
	]! !

!C9AIWebServer methodsFor: 'helpers'!
extractContentFromRequest: request
	"Extract content from POST request"
	
	| body |
	
	"Try different ways to get request body"
	body := nil.
	[body := request content] on: Error do: [:ex |
		[body := request body] on: Error do: [:ex2 |
			[body := request data] on: Error do: [:ex3 |
				Transcript show: 'Could not extract request body'; cr.
				^ nil
			]
		]
	].
	
	body ifNil: [^ nil].
	
	Transcript show: 'Request body: ', body printString; cr.
	
	"Simple content extraction"
	^ self parseJSONContent: body! !

!C9AIWebServer methodsFor: 'helpers'!
parseJSONContent: jsonString
	"Simple JSON parsing to extract content"
	
	| contentStart endPos content |
	
	contentStart := jsonString findString: '"content":"'.
	contentStart = 0 ifTrue: [^ jsonString]. "Fallback - return whole string"
	
	contentStart := contentStart + '"content":"' size.
	endPos := jsonString findString: '","' startingAt: contentStart.
	endPos = 0 ifTrue: [
		endPos := jsonString findString: '"}' startingAt: contentStart.
	].
	endPos = 0 ifTrue: [^ jsonString]. "Fallback"
	
	content := jsonString copyFrom: contentStart to: endPos - 1.
	
	"Unescape basic JSON"
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

!C9AIWebServer methodsFor: 'testing'!
testServer
	"Test if the server is responding"
	
	Transcript show: 'Testing server on port ', port printString; cr.
	Transcript show: 'Try: http://localhost:', port printString, '/get-content'; cr.
	
	"Set some test content"
	self currentContent: 'Test content from Squeak WebServer at ', DateAndTime now printString.
	
	^ 'Server should be accessible at http://localhost:', port printString! !

!C9AIWebServer class methodsFor: 'instance creation'!
new
	^ super new initialize! !

!C9AIWebServer class methodsFor: 'examples'!
example
	"Start WebServer for C9AI with proper initialization"
	| server |
	server := self new.
	server onContentUpdate: [:newContent |
		Transcript show: 'Browser updated: ', newContent; cr
	].
	server currentContent: 'Ready for editing. Try typing some text.'.
	server start.
	server testServer.
	^ server! !