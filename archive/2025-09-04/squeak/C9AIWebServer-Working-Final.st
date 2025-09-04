Object subclass: #C9AIWebServer
	instanceVariableNames: 'webServer currentContent contentUpdateCallback'
	classVariableNames: 'DefaultServer'
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIWebServer methodsFor: 'initialization'!
initialize
	super initialize.
	currentContent := 'Ready for interactive editing from Squeak'.
	contentUpdateCallback := [:content | 
		Transcript show: 'Browser updated: '; show: content; cr]! !

!C9AIWebServer methodsFor: 'content'!
currentContent: aString
	currentContent := aString! !

!C9AIWebServer methodsFor: 'content'!
currentContent
	^ currentContent! !

!C9AIWebServer methodsFor: 'content'!
onContentUpdate: aBlock
	contentUpdateCallback := aBlock! !

!C9AIWebServer methodsFor: 'server'!
start
	"Start using the proven working pattern"
	
	webServer := WebServer reset default.
	webServer listenOn: 7777.
	
	webServer addService: '/get-content' action: [:req | 
		| jsonResponse |
		Transcript show: 'GET /get-content requested'; cr.
		
		jsonResponse := '{"content": "' , (self escapeJSON: currentContent) , '"}'.
		
		req addHeaderName: 'Access-Control-Allow-Origin' value: '*'.
		req addHeaderName: 'Content-Type' value: 'application/json'.
		req send200Response: jsonResponse
	].
	
	webServer addService: '/update-content' action: [:req |
		| content result |
		Transcript show: 'POST /update-content requested'; cr.
		
		req isPostRequest ifTrue: [
			content := self extractContentFromRequest: req.
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
		]
	].
	
	Transcript show: 'C9AI WebServer started successfully'; cr.
	Transcript show: 'Test: http://localhost:7777/get-content'; cr.
	
	^ webServer! !

!C9AIWebServer methodsFor: 'helpers'!
extractContentFromRequest: req
	"Extract content from JSON POST request"
	| data contentStart endPos content |
	
	data := req content.
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
	| result |
	text ifNil: [^ ''].
	
	result := text copyReplaceAll: '"' with: '\"'.
	result := result copyReplaceAll: String cr with: '\\n'.
	^ result! !

!C9AIWebServer class methodsFor: 'examples'!
start
	"Start the working C9AI WebServer"
	| server |
	server := self new.
	server onContentUpdate: [:newContent |
		Transcript show: 'Content changed to: '; show: newContent; cr
	].
	DefaultServer := server.
	^ server start! !

!C9AIWebServer class methodsFor: 'examples'!
stop
	"Stop the server"
	WebServer reset stop.
	Transcript show: 'C9AI WebServer stopped'; cr! !