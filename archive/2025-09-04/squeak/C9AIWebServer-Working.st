Object subclass: #C9AIWebServer
	instanceVariableNames: 'webServer port isRunning contentUpdateCallback currentContent'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIWebServer commentStamp: 'C9AI 8/25/2025 12:00' prior: 0!
Working C9AI web server using correct WebServer API.

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
		Transcript show: 'Content updated: '; show: content; cr]! !

!C9AIWebServer methodsFor: 'configuration'!
port: aPort
	port := aPort! !

!C9AIWebServer methodsFor: 'configuration'!
onContentUpdate: aBlock
	contentUpdateCallback := aBlock! !

!C9AIWebServer methodsFor: 'content'!
currentContent: aString
	currentContent := aString! !

!C9AIWebServer methodsFor: 'content'!
currentContent
	^ currentContent! !

!C9AIWebServer methodsFor: 'server'!
start
	"Start WebServer with correct API"
	isRunning ifTrue: [^ self].
	
	[webServer := WebServer new.
	 webServer initialize.
	 webServer listenOn: port.
	 
	 "Add services with correct 3-argument method"
	 webServer 
		addService: '/update-content' 
		action: [:request | self handleUpdateContent: request]
		methods: webServer defaultHttpMethods.
		
	 webServer 
		addService: '/get-content' 
		action: [:request | self handleGetContent: request]
		methods: webServer defaultHttpMethods.
	 
	 Transcript show: 'Services added successfully'; cr.
	 
	 "Don't call start - server should work after listenOn:"
	 isRunning := true.
	 Transcript show: 'C9AI WebServer running on port '; show: port; cr]
		on: Error 
		do: [:ex |
			Transcript show: 'WebServer error: '; show: ex messageText; cr.
			isRunning := false]! !

!C9AIWebServer methodsFor: 'server'!
stop
	isRunning ifFalse: [^ self].
	
	[webServer ifNotNil: [
		webServer stop.
		webServer := nil.
	].
	 isRunning := false.
	 Transcript show: 'C9AI WebServer stopped'; cr]
		on: Error
		do: [:ex |
			Transcript show: 'Stop error: '; show: ex messageText; cr]! !

!C9AIWebServer methodsFor: 'handlers'!
handleUpdateContent: request
	| content |
	
	Transcript show: 'Handling update content request'; cr.
	
	content := self extractContentFromRequest: request.
	content ifNotNil: [
		currentContent := content.
		contentUpdateCallback value: content.
	].
	
	^ self buildJSONResponse: '{"status": "success"}'! !

!C9AIWebServer methodsFor: 'handlers'!
handleGetContent: request
	| jsonContent |
	
	Transcript show: 'Handling get content request'; cr.
	
	jsonContent := '{"content": "'; 
		, (self escapeJSON: currentContent); 
		, '"}'.
	
	^ self buildJSONResponse: jsonContent! !

!C9AIWebServer methodsFor: 'helpers'!
buildJSONResponse: jsonContent
	"Build HTTP response with CORS headers"
	
	^ 'HTTP/1.1 200 OK', String cr,
	  'Access-Control-Allow-Origin: *', String cr,
	  'Content-Type: application/json', String cr,
	  'Content-Length: ', jsonContent size printString, String cr,
	  String cr,
	  jsonContent! !

!C9AIWebServer methodsFor: 'helpers'!
extractContentFromRequest: request
	| body |
	
	[body := request content] on: Error do: [:ex |
		[body := request body] on: Error do: [:ex2 |
			^ nil
		]
	].
	
	body ifNil: [^ nil].
	^ self parseJSONContent: body! !

!C9AIWebServer methodsFor: 'helpers'!
parseJSONContent: jsonString
	| contentStart endPos content |
	
	contentStart := jsonString findString: '"content":"'.
	contentStart = 0 ifTrue: [^ jsonString].
	
	contentStart := contentStart + 11.
	endPos := jsonString findString: '","' startingAt: contentStart.
	endPos = 0 ifTrue: [
		endPos := jsonString findString: '"}' startingAt: contentStart.
	].
	endPos = 0 ifTrue: [^ jsonString].
	
	content := jsonString copyFrom: contentStart to: endPos - 1.
	content := content copyReplaceAll: '\"' with: '"'.
	content := content copyReplaceAll: '\\n' with: String cr.
	
	^ content! !

!C9AIWebServer methodsFor: 'helpers'!
escapeJSON: text
	| result |
	text ifNil: [^ ''].
	
	result := text copyReplaceAll: '"' with: '\"'.
	result := result copyReplaceAll: String cr with: '\\n'.
	^ result! !

!C9AIWebServer class methodsFor: 'examples'!
example
	| server |
	server := self new.
	server onContentUpdate: [:newContent |
		Transcript show: 'Browser updated: '; show: newContent; cr
	].
	server currentContent: 'Test content from working WebServer'.
	server start.
	
	Transcript show: 'Test: http://localhost:7777/get-content'; cr.
	^ server! !