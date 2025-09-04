Object subclass: #C9AIWebServer
	instanceVariableNames: 'webServer currentContent contentUpdateCallback'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIWebServer methodsFor: 'initialization'!
initialize
	super initialize.
	currentContent := 'Hello from Squeak WebServer'.
	contentUpdateCallback := [:content | 
		Transcript show: 'Updated: '; show: content; cr]! !

!C9AIWebServer methodsFor: 'server'!
start
	"Start using the exact working pattern"
	
	webServer := WebServer reset default.
	webServer listenOn: 7777.
	
	webServer addService: '/get-content' action: [:req | 
		Transcript show: 'GET content request'; cr.
		req send200Response: '{"content": "', currentContent, '"}'
	].
	
	webServer addService: '/update-content' action: [:req |
		Transcript show: 'UPDATE content request'; cr. 
		req send200Response: '{"status": "success"}'
	].
	
	Transcript show: 'Minimal C9AI server on http://localhost:7777/get-content'; cr! !

!C9AIWebServer methodsFor: 'content'!
currentContent: aString
	currentContent := aString! !

!C9AIWebServer class methodsFor: 'examples'!
start
	"Start minimal server"
	^ self new start! !