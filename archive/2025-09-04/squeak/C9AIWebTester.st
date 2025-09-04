Object subclass: #C9AIWebTester
	instanceVariableNames: ''
	classVariableNames: 'Server'
	poolDictionaries: ''
	category: 'C9AI-Web-Testing'!

!C9AIWebTester class methodsFor: 'server management'!
start
	"Start the C9AI Web Server on port 7777"
	
	self stop.
	
	Server := WebServer reset default.
	Server listenOn: 7777.
	
	"Add basic test endpoint"
	Server addService: '/test' action: [:req |
		req send200Response: 'C9AI Web Server is running' contentType: 'text/plain'
	].
	
	Transcript show: 'C9AI Web Server started on http://localhost:7777/test'; cr.
	^ Server! !

!C9AIWebTester class methodsFor: 'server management'!
stop
	"Stop the web server"
	
	Server ifNotNil: [
		[Server destroy] on: Error do: [:ex | 
			Transcript show: 'Error stopping server: '; show: ex messageText; cr
		].
		Server := nil
	].
	Transcript show: 'C9AI Web Server stopped'; cr! !

!C9AIWebTester class methodsFor: 'testing'!
addEditor
	"Add the C9AI editor endpoint"
	
	Server ifNil: [^ self error: 'Server not started. Call C9AIWebTester start first.'].
	
	Server addService: '/editor' action: [:req |
		| component canvas html |
		component := C9AIEditorComponent new.
		canvas := C9AIHTMLCanvas new.
		component renderOn: canvas.
		html := canvas contents.
		req send200Response: html contentType: 'text/html'
	].
	
	Transcript show: 'Editor added: http://localhost:7777/editor'; cr! !

!C9AIWebTester class methodsFor: 'testing'!
addAPIs
	"Add API endpoints with debugging"
	
	Server ifNil: [^ self error: 'Server not started. Call C9AIWebTester start first.'].
	
	"Content API"
	Server addService: '/api/content' action: [:req |
		| content |
		Transcript show: 'GET /api/content requested'; cr.
		content := C9AIEditorComponent content.
		req send200Response: '{"content": "' , content , '"}' contentType: 'application/json'
	].
	
	"Save API with debugging"
	Server addService: '/api/save' action: [:req |
		| jsonData content |
		Transcript show: 'POST /api/save - Method: '; show: req method; cr.
		Transcript show: 'Content received: '; show: req content; cr.
		
		jsonData := req content.
		jsonData ifNil: [
			Transcript show: 'ERROR: No content in request'; cr.
			^ req send200Response: '{"error": "no content"}' contentType: 'application/json'
		].
		
		(jsonData includes: $:) ifTrue: [
			content := jsonData copyAfter: $".
			content := content copyUpTo: $".
			C9AIEditorComponent content: content.
			Transcript show: 'SUCCESS: Saved content: '; show: content; cr.
		] ifFalse: [
			Transcript show: 'ERROR: Could not parse JSON: '; show: jsonData; cr.
		].
		
		req send200Response: '{"status": "success"}' contentType: 'application/json'
	].
	
	"AI Process API"
	Server addService: '/api/ai-process' action: [:req |
		| jsonData content aiResponse |
		Transcript show: 'POST /api/ai-process requested'; cr.
		
		jsonData := req content.
		(jsonData includes: $:) ifTrue: [
			content := jsonData copyAfter: $".
			content := content copyUpTo: $".
			aiResponse := 'AI processed: ' , content.
			Transcript show: 'AI processing: '; show: content; cr.
		].
		
		req send200Response: '{"response": "' , (aiResponse ifNil: ['AI complete']) , '"}' contentType: 'application/json'
	].
	
	Transcript show: 'APIs added: /api/content, /api/save, /api/ai-process'; cr! !

!C9AIWebTester class methodsFor: 'convenience'!
startComplete
	"Start server and add everything"
	
	self start.
	self addEditor.
	self addAPIs.
	
	Transcript show: '=== C9AI Web Application Ready ==='; cr.
	Transcript show: 'Editor: http://localhost:7777/editor'; cr.
	Transcript show: 'Test: http://localhost:7777/test'; cr.
	Transcript show: '=================================='; cr! !

!C9AIWebTester class methodsFor: 'debugging'!
status
	"Show server status"
	
	Server ifNil: [
		Transcript show: 'Server: Not running'; cr.
		^ self
	].
	
	Transcript show: 'Server: Running on port '; show: (Server instVarNamed: 'port'); cr.
	Transcript show: 'Endpoints: '; show: (Server instVarNamed: 'entryPoints') keys; cr! !

!C9AIWebTester class methodsFor: 'debugging'!
testBasic
	"Test basic server functionality"
	
	self start.
	Transcript show: 'Visit http://localhost:7777/test to verify server is running'; cr! !