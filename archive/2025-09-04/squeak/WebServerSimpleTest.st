Object subclass: #WebServerSimpleTest
	instanceVariableNames: ''
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!WebServerSimpleTest class methodsFor: 'testing'!
test
	"Minimal WebServer test"
	| server |
	
	server := WebServer new.
	server initialize.
	server listenOn: 7781.
	
	server addService: '/hello' action: [:request | 'Hello World'].
	
	Transcript show: 'Simple server on port 7781'; cr.
	Transcript show: 'Try: http://localhost:7781/hello'; cr.
	
	^ server! !