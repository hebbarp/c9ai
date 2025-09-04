Object subclass: #WebServerDebug
	instanceVariableNames: 'server'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!WebServerDebug commentStamp: 'C9AI 8/25/2025 12:00' prior: 0!
Debug WebServer to find correct handler registration API.!

!WebServerDebug methodsFor: 'testing'!
testHandlerMethods
	"Test different ways to add handlers to WebServer"
	
	server := WebServer new.
	server initialize.
	server listenOn: 7778.
	
	Transcript show: '=== WebServer Handler Registration Test ==='; cr.
	
	"Method 1: addService:action:"
	[server addService: '/test1' action: [self testResponse: 'Method 1 works'].
	 Transcript show: '✓ addService:action: succeeded'; cr] 
		on: Error do: [:ex | 
			Transcript show: '✗ addService:action: failed: ', ex messageText; cr].
	
	"Method 2: Add via at:put:"
	[server at: '/test2' put: [self testResponse: 'Method 2 works'].
	 Transcript show: '✓ at:put: succeeded'; cr]
		on: Error do: [:ex |
			Transcript show: '✗ at:put: failed: ', ex messageText; cr].
	
	"Method 3: registerService:"
	[server registerService: '/test3' handler: [self testResponse: 'Method 3 works'].
	 Transcript show: '✓ registerService:handler: succeeded'; cr]
		on: Error do: [:ex |
			Transcript show: '✗ registerService:handler: failed: ', ex messageText; cr].
	
	"Method 4: addHandler:"
	[server addHandler: [self testResponse: 'Method 4 works'] for: '/test4'.
	 Transcript show: '✓ addHandler:for: succeeded'; cr]
		on: Error do: [:ex |
			Transcript show: '✗ addHandler:for: failed: ', ex messageText; cr].
	
	"Show available methods"
	Transcript show: 'WebServer methods containing "add": ', 
		(server class methodDict keys select: [:k | k includesSubstring: 'add']) printString; cr.
	Transcript show: 'WebServer methods containing "service": ',
		(server class methodDict keys select: [:k | k includesSubstring: 'service']) printString; cr.
	Transcript show: 'WebServer methods containing "handler": ',
		(server class methodDict keys select: [:k | k includesSubstring: 'handler']) printString; cr.
	
	"Try to start"
	[server start] on: Error do: [:ex | 
		Transcript show: 'Start failed (expected): ', ex messageText; cr].
	
	Transcript show: '=== Test URLs (if any method worked) ==='; cr.
	Transcript show: 'http://localhost:7778/test1'; cr.
	Transcript show: 'http://localhost:7778/test2'; cr.
	Transcript show: 'http://localhost:7778/test3'; cr.
	Transcript show: 'http://localhost:7778/test4'; cr.
	
	^ server! !

!WebServerDebug methodsFor: 'helpers'!
testResponse: message
	"Return a test response"
	^ 'HTTP/1.1 200 OK', String cr,
	  'Content-Type: text/plain', String cr,
	  'Content-Length: ', message size printString, String cr,
	  String cr,
	  message! !

!WebServerDebug methodsFor: 'inspection'!
inspectWebServer
	"Inspect the WebServer instance to see its structure"
	
	server := WebServer new.
	server initialize.
	
	Transcript show: '=== WebServer Instance Inspection ==='; cr.
	Transcript show: 'WebServer class: ', server class printString; cr.
	Transcript show: 'Instance variables: ', server class instVarNames printString; cr.
	Transcript show: 'All methods: ', (server class methodDict keys asSortedCollection first: 20) printString; cr.
	
	server inspect.
	
	^ server! !

!WebServerDebug class methodsFor: 'testing'!
run
	"Run the WebServer debugging tests"
	^ self new testHandlerMethods! !

!WebServerDebug class methodsFor: 'testing'!
inspect
	"Inspect WebServer class and instance"
	^ self new inspectWebServer! !