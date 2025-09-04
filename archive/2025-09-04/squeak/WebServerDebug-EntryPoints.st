Object subclass: #WebServerDebug2
	instanceVariableNames: 'server'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!WebServerDebug2 commentStamp: 'C9AI 8/25/2025 12:00' prior: 0!
Test WebServer entryPoints dictionary approach.!

!WebServerDebug2 methodsFor: 'testing'!
testEntryPoints
	"Test direct manipulation of entryPoints"
	
	server := WebServer new.
	server initialize.
	server listenOn: 7779.
	
	Transcript show: '=== Testing WebServer entryPoints ==='; cr.
	
	"Check initial entryPoints"
	Transcript show: 'Initial entryPoints: ', server instVarNamed: 'entryPoints'; cr.
	
	"Try to add directly to entryPoints"
	| entryPoints |
	entryPoints := server instVarNamed: 'entryPoints'.
	
	[entryPoints at: '/direct-test' put: [:request | self testResponse: 'Direct entryPoints works'].
	 Transcript show: 'Direct entryPoints assignment succeeded'; cr]
		on: Error do: [:ex |
			Transcript show: '✗ Direct entryPoints failed: ', ex messageText; cr].
	
	"Check what addService actually does"
	[server addService: '/addservice-test' action: [:request | self testResponse: 'addService works'].
	 Transcript show: '✓ addService completed'; cr.
	 Transcript show: 'EntryPoints after addService: ', entryPoints printString; cr]
		on: Error do: [:ex |
			Transcript show: '✗ addService failed: ', ex messageText; cr].
	
	"Try alternative service methods"
	server class methodDict keysAndValuesDo: [:selector :method |
		(selector includesSubstring: 'service') ifTrue: [
			Transcript show: 'Service method: ', selector printString, ' args: ', method numArgs printString; cr
		]
	].
	
	"Try to start"
	[server start] on: Error do: [:ex | 
		Transcript show: 'Start failed: ', ex messageText; cr].
	
	Transcript show: '=== Test these URLs ==='; cr.
	Transcript show: 'http://localhost:7779/direct-test'; cr.
	Transcript show: 'http://localhost:7779/addservice-test'; cr.
	
	^ server! !

!WebServerDebug2 methodsFor: 'helpers'!
testResponse: message
	"Return a simple test response"
	^ message! !

!WebServerDebug2 class methodsFor: 'testing'!
run
	"Run the entryPoints test"
	^ self new testEntryPoints! !