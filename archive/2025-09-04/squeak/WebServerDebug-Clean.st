Object subclass: #WebServerDebug3
	instanceVariableNames: 'server'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!WebServerDebug3 commentStamp: 'C9AI 8/25/2025 12:00' prior: 0!
Clean WebServer test without Unicode characters.!

!WebServerDebug3 methodsFor: 'testing'!
testEntryPoints
	"Test direct manipulation of entryPoints"
	
	server := WebServer new.
	server initialize.
	server listenOn: 7779.
	
	Transcript show: '=== Testing WebServer entryPoints ==='; cr.
	
	"Check initial entryPoints"
	Transcript show: 'Initial entryPoints: '; show: (server instVarNamed: 'entryPoints'); cr.
	
	"Try to add directly to entryPoints"
	| entryPoints |
	entryPoints := server instVarNamed: 'entryPoints'.
	
	[entryPoints at: '/direct-test' put: [:request | self testResponse: 'Direct entryPoints works'].
	 Transcript show: 'SUCCESS: Direct entryPoints assignment worked'; cr]
		on: Error do: [:ex |
			Transcript show: 'FAILED: Direct entryPoints failed: '; show: ex messageText; cr].
	
	"Check what addService actually does"
	[server addService: '/addservice-test' action: [:request | self testResponse: 'addService works'].
	 Transcript show: 'SUCCESS: addService completed'; cr.
	 Transcript show: 'EntryPoints after addService: '; show: entryPoints; cr]
		on: Error do: [:ex |
			Transcript show: 'FAILED: addService failed: '; show: ex messageText; cr].
	
	"Try alternative service methods"
	server class methodDict keysAndValuesDo: [:selector :method |
		(selector includesSubstring: 'service') ifTrue: [
			Transcript show: 'Service method: '; show: selector; show: ' args: '; show: method numArgs; cr
		]
	].
	
	"Try to start"
	[server start] on: Error do: [:ex | 
		Transcript show: 'Start failed: '; show: ex messageText; cr].
	
	Transcript show: '=== Test these URLs ==='; cr.
	Transcript show: 'http://localhost:7779/direct-test'; cr.
	Transcript show: 'http://localhost:7779/addservice-test'; cr.
	
	^ server! !

!WebServerDebug3 methodsFor: 'helpers'!
testResponse: message
	"Return a simple test response"
	^ message! !

!WebServerDebug3 class methodsFor: 'testing'!
run
	"Run the clean entryPoints test"
	^ self new testEntryPoints! !