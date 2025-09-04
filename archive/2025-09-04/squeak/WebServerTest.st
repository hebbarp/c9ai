Object subclass: #WebServerTest
	instanceVariableNames: 'server'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!WebServerTest commentStamp: 'C9AI 8/25/2025 12:00' prior: 0!
Simple test of Squeak's WebServer to understand its API.!

!WebServerTest methodsFor: 'testing'!
testBasicServer
	"Test basic WebServer functionality"
	
	[server := WebServer new.
	 Transcript show: 'WebServer created: ', server printString; cr.
	 
	 "Try to start on port 7777"
	 server listenOn: 7777.
	 Transcript show: 'WebServer listening on port 7777'; cr.
	 
	 server start.
	 Transcript show: 'WebServer started successfully'; cr.
	 
	 ^ server]
		on: Error 
		do: [:ex |
			Transcript show: 'WebServer error: ', ex messageText; cr.
			^ nil]! !

!WebServerTest methodsFor: 'testing'!
stopServer
	"Stop the test server"
	server ifNotNil: [
		[server stop.
		 Transcript show: 'WebServer stopped'; cr]
			on: Error do: [:ex |
				Transcript show: 'Stop error: ', ex messageText; cr]
	]! !

!WebServerTest class methodsFor: 'testing'!
run
	"Run the WebServer test"
	^ self new testBasicServer! !