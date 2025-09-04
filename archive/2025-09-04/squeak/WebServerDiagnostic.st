Object subclass: #WebServerDiagnostic
	instanceVariableNames: ''
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!WebServerDiagnostic class methodsFor: 'testing'!
test
	"Test WebServer service registration"
	| server |
	
	server := WebServer reset default.
	server listenOn: 7782.
	
	Transcript show: 'Before addService - entryPoints: '; 
		show: (server instVarNamed: 'entryPoints'); cr.
	
	server addService: '/test' action: [:req | 
		req send200Response: 'It works'
	].
	
	Transcript show: 'After addService - entryPoints: '; 
		show: (server instVarNamed: 'entryPoints'); cr.
	
	Transcript show: 'Test: http://localhost:7782/test'; cr.
	
	^ server! !