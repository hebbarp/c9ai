Object subclass: #C9AIWebServer
	instanceVariableNames: 'webServer port isRunning contentUpdateCallback currentContent'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIWebServer commentStamp: 'C9AI 8/25/2025 12:00' prior: 0!
Final working C9AI web server using WebServer example pattern.

Usage:
  server := C9AIWebServer new.
  server onContentUpdate: [:newContent | "handle update here"].
  server start.!

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
	"Start WebServer using the example pattern"
	isRunning ifTrue: [^ self].
	
	[webServer := WebServer reset default.
	 webServer listenOn: port.
	 
	 "Add update service"
	 webServer addService: '/update-content' action: [:req | 
		self handleRequest: req type: 'update'].
	 
	 "Add get service"  
	 webServer addService: '/get-content' action: [:req |
		self handleRequest: req type: 'get'].
	 
	 isRunning := true.
	 Transcript show: 'C9AI WebServer started on port '; show: port; cr.
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
	"Handle requests using WebServer example pattern"
	
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
			Transcript show: 'Updated content: '; show: content; cr.
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