Object subclass: #C9AIWebServer
	instanceVariableNames: 'server port isRunning contentUpdateCallback currentContent'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIWebServer commentStamp: 'C9AI 8/25/2025 12:00' prior: 0!
Native Squeak HTTP server for bidirectional communication with Unicode editor browser.
Uses Squeak's built-in WebServer instead of external Python.

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
	"Start the native Squeak HTTP server"
	isRunning ifTrue: [^ self].
	
	[self startNativeServer.
	 isRunning := true.
	 Transcript show: 'C9AI Native Web Server started on port ', port printString; cr]
		on: Error 
		do: [:ex |
			Transcript show: 'Failed to start native web server: ', ex messageText; cr.
			Transcript show: 'Trying fallback approach...'; cr.
			self startFallbackServer]! !

!C9AIWebServer methodsFor: 'server'!
stop
	"Stop the HTTP server"
	isRunning ifFalse: [^ self].
	
	[server ifNotNil: [
		server destroy.
		server := nil.
	].
	 isRunning := false.
	 Transcript show: 'C9AI Native Web Server stopped'; cr]
		on: Error
		do: [:ex |
			Transcript show: 'Error stopping server: ', ex messageText; cr]! !

!C9AIWebServer methodsFor: 'server'!
startNativeServer
	"Start server using Squeak's built-in WebServer"
	
	"Try WebServer first"
	[server := (Smalltalk at: #WebServer) new.
	 server listenOn: port.
	 server addService: '/update-content' action: [:request | self handleUpdateContent: request].
	 server addService: '/get-content' action: [:request | self handleGetContent: request].
	 server start.
	 ^ self] on: Error do: [:ex |
		Transcript show: 'WebServer not available: ', ex messageText; cr
	].
	
	"Try HTTPServer as fallback"
	[server := (Smalltalk at: #HTTPServer) new.
	 server port: port.
	 server addHandler: (self createHandler).
	 server start.
	 ^ self] on: Error do: [:ex |
		Transcript show: 'HTTPServer not available: ', ex messageText; cr
	].
	
	"Try basic socket approach"
	self startSocketServer! !

!C9AIWebServer methodsFor: 'server'!
startSocketServer
	"Start basic socket server as final fallback"
	
	| socket |
	socket := Socket newTCP.
	socket listenOn: port backlogSize: 10.
	socket isWaitingForConnection ifTrue: [
		server := socket.
		[self handleSocketConnections] fork.
		Transcript show: 'Started basic socket server on port ', port printString; cr
	] ifFalse: [
		self error: 'Could not bind to port ', port printString
	]! !

!C9AIWebServer methodsFor: 'server'!
handleSocketConnections
	"Handle incoming socket connections"
	
	[isRunning] whileTrue: [
		| connection |
		[connection := server waitForAcceptFor: 1.
		 connection ifNotNil: [
			[self handleHTTPRequest: connection] 
				ensure: [connection close]
		 ]] on: Error do: [:ex |
			"Connection timeout or error - continue"
		]
	]! !

!C9AIWebServer methodsFor: 'handlers'!
handleHTTPRequest: connection
	"Handle basic HTTP request on socket connection"
	
	| request response |
	
	"Read request"
	request := String streamContents: [:stream |
		| line |
		[line := connection readLine.
		 line notEmpty] whileTrue: [
			stream nextPutAll: line; cr
		]
	].
	
	"Parse and handle request"
	(request includesSubstring: 'POST /update-content') ifTrue: [
		response := self handleUpdateContentSocket: request.
	] ifFalse: [
		(request includesSubstring: 'GET /get-content') ifTrue: [
			response := self handleGetContentSocket: request.
		] ifFalse: [
			response := self handleOptionsSocket: request.
		]
	].
	
	"Send response"
	connection nextPutAll: response! !

!C9AIWebServer methodsFor: 'handlers'!
handleUpdateContentSocket: request
	"Handle content update via socket"
	
	| contentStart content |
	
	"Extract JSON content from POST body"
	contentStart := request findString: '{"content"'.
	contentStart > 0 ifTrue: [
		| jsonData |
		jsonData := request copyFrom: contentStart to: request size.
		"Simple JSON parsing - extract content between quotes"
		content := self extractContentFromJSON: jsonData.
		currentContent := content.
		contentUpdateCallback value: content.
	].
	
	^ self buildCORSResponse: '{"status": "success"}'! !

!C9AIWebServer methodsFor: 'handlers'!
handleGetContentSocket: request
	"Handle content request via socket"
	
	| jsonResponse |
	jsonResponse := '{"content": "', (self escapeJSON: currentContent), '"}'.
	
	^ self buildCORSResponse: jsonResponse! !

!C9AIWebServer methodsFor: 'handlers'!
handleOptionsSocket: request
	"Handle CORS preflight request"
	
	^ 'HTTP/1.1 200 OK', String cr,
	   'Access-Control-Allow-Origin: *', String cr,
	   'Access-Control-Allow-Methods: POST, GET, OPTIONS', String cr,
	   'Access-Control-Allow-Headers: Content-Type', String cr,
	   'Content-Length: 0', String cr,
	   String cr! !

!C9AIWebServer methodsFor: 'helpers'!
buildCORSResponse: content
	"Build HTTP response with CORS headers"
	
	^ 'HTTP/1.1 200 OK', String cr,
	   'Access-Control-Allow-Origin: *', String cr,
	   'Access-Control-Allow-Methods: POST, GET, OPTIONS', String cr,
	   'Access-Control-Allow-Headers: Content-Type', String cr,
	   'Content-Type: application/json', String cr,
	   'Content-Length: ', content size printString, String cr,
	   String cr,
	   content! !

!C9AIWebServer methodsFor: 'helpers'!
extractContentFromJSON: jsonString
	"Simple JSON content extraction"
	
	| startPos endPos |
	startPos := jsonString findString: '"content":"'.
	startPos = 0 ifTrue: [^ ''].
	
	startPos := startPos + '"content":"' size.
	endPos := jsonString findString: '","timestamp"' startingAt: startPos.
	endPos = 0 ifTrue: [
		endPos := jsonString findString: '"}' startingAt: startPos.
	].
	endPos = 0 ifTrue: [^ ''].
	
	^ (jsonString copyFrom: startPos to: endPos - 1) 
		copyReplaceAll: '\"' with: '"'! !

!C9AIWebServer methodsFor: 'helpers'!
escapeJSON: text
	"Escape text for JSON"
	
	| result |
	result := text copyReplaceAll: '"' with: '\"'.
	result := result copyReplaceAll: String cr with: '\n'.
	result := result copyReplaceAll: String lf with: '\n'.
	^ result! !

!C9AIWebServer methodsFor: 'server'!
startFallbackServer
	"Fallback to file-based communication if no HTTP server available"
	
	Transcript show: 'Using file-based fallback communication'; cr.
	server := 'file-based'.
	isRunning := true.
	
	"Start file monitoring"
	[self monitorFileUpdates] fork! !

!C9AIWebServer methodsFor: 'server'!
monitorFileUpdates
	"Monitor for file-based updates when no HTTP server available"
	
	[isRunning] whileTrue: [
		[FileStream readOnlyFileNamed: '/tmp/c9ai_browser_content.txt' do: [:file |
			| content |
			content := file contents.
			content notEmpty ifTrue: [
				currentContent := content.
				contentUpdateCallback value: content.
				"Clear the file"
				FileStream newFileNamed: '/tmp/c9ai_browser_content.txt' do: [:f |
					f nextPutAll: ''
				]
			]
		]] on: Error do: [:ex |
			"File doesn't exist - no update"
		].
		(Delay forMilliseconds: 500) wait
	]! !

!C9AIWebServer methodsFor: 'communication'!
sendContentToBrowser: content
	"Send content to browser"
	
	currentContent := content.
	
	"For file-based fallback"
	FileStream newFileNamed: '/tmp/c9ai_squeak_content.txt' do: [:file |
		file nextPutAll: content
	]! !

!C9AIWebServer class methodsFor: 'instance creation'!
new
	^ super new initialize! !

!C9AIWebServer class methodsFor: 'examples'!
example
	"Start native Squeak web server for C9AI"
	| server |
	server := self new.
	server onContentUpdate: [:newContent |
		Transcript show: 'Browser updated content: ', newContent; cr
	].
	server start.
	^ server! !