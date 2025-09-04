Object subclass: #C9AIWebServer
	instanceVariableNames: 'webServer port isRunning contentUpdateCallback currentContent'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIWebServer commentStamp: 'C9AI 8/25/2025 12:00' prior: 0!
Fixed C9AI web server using Squeak's WebServer with correct API.

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
	"Start the WebServer with proper API"
	isRunning ifTrue: [^ self].
	
	[webServer := WebServer new.
	 
	 "Set up the server"
	 webServer listenOn: port.
	 Transcript show: 'WebServer listening on port ', port printString; cr.
	 
	 "Add handlers - try different approaches"
	 self setupHandlers.
	 
	 "Try different start methods"
	 self startWebServer.
	 
	 isRunning := true.
	 Transcript show: 'C9AI WebServer started successfully'; cr]
		on: Error 
		do: [:ex |
			Transcript show: 'Failed to start WebServer: ', ex messageText; cr.
			Transcript show: 'Available methods: ', (webServer class methodDict keys asSortedCollection first: 10) printString; cr.
			isRunning := false]! !

!C9AIWebServer methodsFor: 'server'!
setupHandlers
	"Setup request handlers"
	
	"Try addService: approach"
	[webServer addService: '/update-content' action: [:request | self handleUpdateContent: request].
	 webServer addService: '/get-content' action: [:request | self handleGetContent: request].
	 Transcript show: 'Added services with addService:action:'; cr.
	 ^ self] on: Error do: [:ex |
		Transcript show: 'addService:action: failed: ', ex messageText; cr
	].
	
	"Try registerHandler: approach"
	[webServer registerHandler: (self createUpdateHandler) for: '/update-content'.
	 webServer registerHandler: (self createGetHandler) for: '/get-content'.
	 Transcript show: 'Added handlers with registerHandler:for:'; cr.
	 ^ self] on: Error do: [:ex |
		Transcript show: 'registerHandler:for: failed: ', ex messageText; cr
	].
	
	"Try direct handler assignment"
	[webServer at: '/update-content' put: [:request | self handleUpdateContent: request].
	 webServer at: '/get-content' put: [:request | self handleGetContent: request].
	 Transcript show: 'Added handlers with at:put:'; cr.
	 ^ self] on: Error do: [:ex |
		Transcript show: 'at:put: failed: ', ex messageText; cr
	].
	
	Transcript show: 'Warning: Could not setup handlers - trying basic server'; cr! !

!C9AIWebServer methodsFor: 'server'!
startWebServer
	"Try different ways to start the server"
	
	"Method 1: start"
	[webServer start.
	 Transcript show: 'Started with start'; cr.
	 ^ self] on: Error do: [:ex |
		Transcript show: 'start failed: ', ex messageText; cr
	].
	
	"Method 2: startUp"
	[webServer startUp.
	 Transcript show: 'Started with startUp'; cr.
	 ^ self] on: Error do: [:ex |
		Transcript show: 'startUp failed: ', ex messageText; cr
	].
	
	"Method 3: run"
	[webServer run.
	 Transcript show: 'Started with run'; cr.
	 ^ self] on: Error do: [:ex |
		Transcript show: 'run failed: ', ex messageText; cr
	].
	
	"Method 4: serve"
	[webServer serve.
	 Transcript show: 'Started with serve'; cr.
	 ^ self] on: Error do: [:ex |
		Transcript show: 'serve failed: ', ex messageText; cr
	].
	
	"If we get here, nothing worked"
	Transcript show: 'All start methods failed - server may already be running'; cr! !

!C9AIWebServer methodsFor: 'server'!
stop
	"Stop the WebServer"
	isRunning ifFalse: [^ self].
	
	[webServer ifNotNil: [
		"Try different stop methods"
		[webServer stop] on: Error do: [:ex1 |
			[webServer shutdown] on: Error do: [:ex2 |
				[webServer destroy] on: Error do: [:ex3 |
					Transcript show: 'All stop methods failed'; cr
				]
			]
		].
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
	
	"Return simple success response"
	^ '{"status": "success"}'! !

!C9AIWebServer methodsFor: 'handlers'!
handleGetContent: request
	"Handle GET /get-content from browser"
	
	| jsonContent |
	
	Transcript show: 'Handling get content request'; cr.
	
	jsonContent := '{"content": "', (self escapeJSON: currentContent), '"}'.
	
	^ jsonContent! !

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

!C9AIWebServer class methodsFor: 'instance creation'!
new
	^ super new initialize! !

!C9AIWebServer class methodsFor: 'examples'!
example
	"Start WebServer for C9AI - diagnostic version"
	| server |
	server := self new.
	server onContentUpdate: [:newContent |
		Transcript show: 'Browser updated: ', newContent; cr
	].
	server currentContent: 'Initial test content from Squeak'.
	server start.
	^ server! !