Object subclass: #C9AIWebServer
	instanceVariableNames: 'server port isRunning contentUpdateCallback currentContent'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIWebServer commentStamp: 'C9AI 8/25/2025 12:00' prior: 0!
Simple HTTP server for bidirectional communication with Unicode editor browser.
Handles POST requests from editable HTML templates.

Usage:
  server := C9AIWebServer new.
  server onContentUpdate: [:newContent | "handle update here"].
  server start.!

!C9AIWebServer methodsFor: 'initialization'!
initialize
	super initialize.
	port := 7777.
	isRunning := false.
	currentContent := ''.
	contentUpdateCallback := [:content | 
		Transcript show: 'Content updated: ', content; cr]! !

!C9AIWebServer methodsFor: 'configuration'!
port: aPort
	port := aPort! !

!C9AIWebServer methodsFor: 'configuration'!
onContentUpdate: aBlock
	"Set callback for when browser sends content updates"
	contentUpdateCallback := aBlock! !

!C9AIWebServer methodsFor: 'content'!
currentContent: aString
	currentContent := aString! !

!C9AIWebServer methodsFor: 'content'!
currentContent
	^ currentContent! !

!C9AIWebServer methodsFor: 'server'!
start
	"Start the HTTP server"
	isRunning ifTrue: [^ self].
	
	[self startServer.
	 isRunning := true.
	 Transcript show: 'C9AI Web Server started on port ', port printString; cr]
		on: Error 
		do: [:ex |
			Transcript show: 'Failed to start web server: ', ex messageText; cr.
			isRunning := false]! !

!C9AIWebServer methodsFor: 'server'!
stop
	"Stop the HTTP server"
	isRunning ifFalse: [^ self].
	
	[server ifNotNil: [server stop].
	 server := nil.
	 isRunning := false.
	 Transcript show: 'C9AI Web Server stopped'; cr]
		on: Error
		do: [:ex |
			Transcript show: 'Error stopping server: ', ex messageText; cr]! !

!C9AIWebServer methodsFor: 'server'!
startServer
	"Start the actual HTTP server - simplified version"
	
	"This is a simplified version that uses OSProcess to start a simple Python server"
	"For a full Squeak HTTP server, you'd use WebServer or similar package"
	
	| serverScript |
	serverScript := self createServerScript.
	
	"Start Python server in background"
	OSProcess command: 'python3 ', serverScript, ' &'.
	
	"Give it time to start"
	(Delay forMilliseconds: 1000) wait! !

!C9AIWebServer methodsFor: 'server'!
createServerScript
	"Create a simple Python HTTP server script"
	| scriptPath scriptContent |
	
	scriptPath := '/tmp/c9ai_server.py'.
	
	scriptContent := 'import http.server
import socketserver
import json
import urllib.parse
from http.server import BaseHTTPRequestHandler

class C9AIHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/update-content":
            content_length = int(self.headers["Content-Length"])
            post_data = self.rfile.read(content_length).decode("utf-8")
            
            # Write content to temp file for Squeak to read
            with open("/tmp/c9ai_browser_content.txt", "w", encoding="utf-8") as f:
                data = json.loads(post_data)
                f.write(data["content"])
            
            # Send success response with CORS headers
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b''{"status": "success"}'')
    
    def do_GET(self):
        if self.path == "/get-content":
            try:
                with open("/tmp/c9ai_squeak_content.txt", "r", encoding="utf-8") as f:
                    content = f.read()
            except:
                content = "No content available"
            
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            response = json.dumps({"content": content})
            self.wfile.write(response.encode("utf-8"))
    
    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

with socketserver.TCPServer(("", 7777), C9AIHandler) as httpd:
    print("C9AI server running on port 7777")
    httpd.serve_forever()'.

	"Write script to file"
	FileStream newFileNamed: scriptPath do: [:file |
		file nextPutAll: scriptContent
	].
	
	^ scriptPath! !

!C9AIWebServer methodsFor: 'monitoring'!
checkForUpdates
	"Check if browser has sent any content updates"
	| updateFile |
	updateFile := '/tmp/c9ai_browser_content.txt'.
	
	[FileStream readOnlyFileNamed: updateFile do: [:file |
		| newContent |
		newContent := file contents.
		newContent ~= currentContent ifTrue: [
			currentContent := newContent.
			contentUpdateCallback value: newContent.
			"Clear the update file"
			FileStream newFileNamed: updateFile do: [:f | f nextPutAll: '']
		]
	]] on: Error do: [:ex |
		"File doesn't exist yet - no updates"
	]! !

!C9AIWebServer methodsFor: 'monitoring'!
startMonitoring
	"Start monitoring for browser updates"
	[isRunning] whileTrue: [
		self checkForUpdates.
		(Delay forMilliseconds: 500) wait
	]! !

!C9AIWebServer methodsFor: 'communication'!
sendContentToBrowser: content
	"Send content to browser (for reload functionality)"
	FileStream newFileNamed: '/tmp/c9ai_squeak_content.txt' do: [:file |
		file nextPutAll: content
	]! !

!C9AIWebServer class methodsFor: 'instance creation'!
new
	^ super new initialize! !

!C9AIWebServer class methodsFor: 'examples'!
example
	"Start a simple web server for C9AI"
	| server |
	server := self new.
	server onContentUpdate: [:newContent |
		Transcript show: 'Browser updated content: ', newContent; cr
	].
	server start.
	server startMonitoring.
	^ server! !