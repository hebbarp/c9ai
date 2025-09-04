Object subclass: #C9AIWebServer
	instanceVariableNames: 'webServer port isRunning contentUpdateCallback currentContent'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIWebServer methodsFor: 'initialization'!
initialize
	super initialize.
	port := 7777.
	isRunning := false.
	currentContent := 'Ready for editing from Squeak'.
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
	"Start WebServer and ensure it's fully running"
	isRunning ifTrue: [^ self].
	
	[webServer := WebServer reset default.
	 webServer listenOn: port.
	 
	 "Add services"
	 webServer addService: '/get-content' action: [:req | 
		self handleRequest: req type: 'get'].
	 
	 webServer addService: '/update-content' action: [:req |
		self handleRequest: req type: 'update'].
	 
	 "Force the server to start accepting connections"
	 [webServer startListening] on: Error do: [:ex |
		Transcript show: 'startListening failed: '; show: ex messageText; cr.
	 ].
	 
	 "Try alternative start methods"
	 [webServer start] on: Error do: [:ex |
		Transcript show: 'start failed: '; show: ex messageText; cr.
	 ].
	 
	 "Check if we're now accepting connections"
	 (webServer instVarNamed: 'listenerSocket') ifNotNil: [:socket |
		Transcript show: 'Socket state: '; show: socket; cr.
	 ].
	 
	 isRunning := true.
	 Transcript show: 'C9AI WebServer setup on port '; show: port; cr.
	 Transcript show: 'EntryPoints: '; show: (webServer instVarNamed: 'entryPoints'); cr.
	 Transcript show: 'Test: http://localhost:'; show: port; show: '/get-content'; cr]
		on: Error 
		do: [:ex |
			Transcript show: 'WebServer error: '; show: ex messageText; cr.
			isRunning := false]! !

!C9AIWebServer methodsFor: 'server'!
stop
	isRunning ifFalse: [^ self].
	
	[webServer ifNotNil: [webServer stop].
	 isRunning := false.
	 Transcript show: 'C9AI WebServer stopped'; cr]
		on: Error
		do: [:ex |
			Transcript show: 'Stop error: '; show: ex messageText; cr]! !

!C9AIWebServer methodsFor: 'handlers'!
handleRequest: req type: requestType
	"Handle requests"
	
	Transcript show: 'Handling request: '; show: requestType; cr.
	
	requestType = 'get' ifTrue: [
		^ self handleGetRequest: req
	].
	
	requestType = 'update' ifTrue: [
		^ self handleUpdateRequest: req
	].
	
	req send404Response! !

!C9AIWebServer methodsFor: 'handlers'!
handleGetRequest: req
	"Handle GET /get-content"
	
	| jsonResponse |
	
	Transcript show: 'GET request for content'; cr.
	
	jsonResponse := '{"content": "' 
		, (self escapeJSON: currentContent) 
		, '"}'.
	
	req addHeaderName: 'Access-Control-Allow-Origin' value: '*'.
	req addHeaderName: 'Content-Type' value: 'application/json'.
	req send200Response: jsonResponse! !

!C9AIWebServer methodsFor: 'handlers'!
handleUpdateRequest: req
	"Handle POST /update-content"
	
	| content result |
	
	req isPostRequest ifTrue: [
		Transcript show: 'POST request to update content'; cr.
		
		content := self extractContentFromData: req content.
		content ifNotNil: [
			currentContent := content.
			contentUpdateCallback value: content.
		].
		
		result := '{"status": "success"}'.
		req addHeaderName: 'Access-Control-Allow-Origin' value: '*'.
		req addHeaderName: 'Content-Type' value: 'application/json'.
		req send200Response: result
	] ifFalse: [
		req send404Response
	]! !

!C9AIWebServer methodsFor: 'helpers'!
extractContentFromData: data
	"Extract content from POST data"
	
	| contentStart endPos content |
	
	data ifNil: [^ nil].
	
	contentStart := data findString: '"content":"'.
	contentStart = 0 ifTrue: [^ nil].
	
	contentStart := contentStart + 11.
	endPos := data findString: '","' startingAt: contentStart.
	endPos = 0 ifTrue: [
		endPos := data findString: '"}' startingAt: contentStart.
	].
	endPos = 0 ifTrue: [^ nil].
	
	content := data copyFrom: contentStart to: endPos - 1.
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
	^ result! !

!C9AIWebServer class methodsFor: 'examples'!
example
	"Start working C9AI WebServer"
	| server |
	server := self new.
	server onContentUpdate: [:newContent |
		Transcript show: 'Browser says: '; show: newContent; cr
	].
	server start.
	^ server! !