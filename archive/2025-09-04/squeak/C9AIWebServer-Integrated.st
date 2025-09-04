Object subclass: #C9AIWebServer
	instanceVariableNames: 'webServer port isRunning contentUpdateCallback currentContent'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIWebServer commentStamp: 'C9AI 8/26/2025 12:00' prior: 0!
C9AI WebServer integrated with working WebServer pattern.
Uses the proven direct service pattern that works without freezing.

Usage:
  server := C9AIWebServer new.
  server onContentUpdate: [:newContent | "handle update here"].
  server start.
  
Then visit: http://localhost:7777/editor!

!C9AIWebServer methodsFor: 'initialization'!
initialize
	super initialize.
	port := 7777.
	isRunning := false.
	currentContent := 'ನಮಸ್ಕಾರ from C9AI Welcome to Unicode editing in Squeak.'.
	contentUpdateCallback := [:content | 
		Transcript show: 'Content updated: '; show: content; cr]! !

!C9AIWebServer methodsFor: 'configuration'!
port: aPort
	port := aPort! !

!C9AIWebServer methodsFor: 'configuration'!
onContentUpdate: aBlock
	contentUpdateCallback := aBlock! !

!C9AIWebServer methodsFor: 'content'!
currentContent: aString
	currentContent := aString! !

!C9AIWebServer methodsFor: 'content'!
currentContent
	^ currentContent! !

!C9AIWebServer methodsFor: 'server'!
start
	"Start WebServer using the proven working pattern"
	isRunning ifTrue: [^ self].
	
	[webServer := WebServer reset default.
	 webServer listenOn: port.
	 
	 "Add get-content service using working pattern"
	 webServer addService: '/get-content' action: [:req |
		| jsonResponse |
		Transcript show: 'GET content request'; cr.
		jsonResponse := '{"content": "' , (self escapeJSON: currentContent) , '"}'. 
		req send200Response: jsonResponse].
		
	 "Add update-content service using working pattern"
	 webServer addService: '/update-content' action: [:req |
		| content jsonData |
		Transcript show: 'UPDATE request - Content: '; show: req content; cr.
		
		"Simple JSON parsing that works"
		jsonData := req content.
		(jsonData includes: $:) ifTrue: [
			content := jsonData copyAfter: $".
			content := content copyUpTo: $".
			currentContent := content.
			contentUpdateCallback value: content.
			Transcript show: 'Stored: '; show: currentContent; cr.
		].
		
		req send200Response: '{"status": "success"}'].
	 
	 "Add interactive editor page using working pattern"
	 webServer addService: '/editor' action: [:req |
		| htmlContent |
		Transcript show: 'Serving editor page'; cr.
		
		htmlContent := '<html><body style="font-family: Arial; margin: 20px; 
  background: lightgray;"><h1 style="background: blue; color: white; 
  padding: 20px; text-align: center;">C9AI Editor</h1><div style="margin: 
  20px 0;"><button onclick="saveContent()" style="background: blue; color: 
  white; border: none; padding: 10px 20px; margin: 5px; cursor: 
  pointer;">Save</button><button onclick="reloadContent()" 
  style="background: green; color: white; border: none; padding: 10px 20px;
   margin: 5px; cursor: pointer;">Reload</button><span id="status" 
  style="margin-left: 20px; color: gray;">Ready</span></div><div 
  id="content" contenteditable="true" style="background: white; padding: 
  20px; min-height: 200px; border: 1px solid gray; font-size: 16px; 
  font-family: Arial;">Default content here</div><script>function 
  saveContent() { var text = document.getElementById("content").innerText; 
  document.getElementById("status").innerText = "Saving..."; 
  fetch("/update-content", { method: "POST", body: JSON.stringify({content:
   text}) }).then(function(response) { if (response.ok) { 
  document.getElementById("status").innerText = "Saved"; } else { 
  document.getElementById("status").innerText = "Failed"; } }); } function 
  reloadContent() { document.getElementById("status").innerText = 
  "Loading..."; fetch("/get-content").then(function(response) { return 
  response.json(); }).then(function(data) { 
  document.getElementById("content").innerText = data.content; 
  document.getElementById("status").innerText = "Loaded"; }); 
  }</script></body></html>'.
		
		req send200Response: htmlContent].
	 
	 isRunning := true.
	 Transcript show: 'C9AI WebServer started on port '; show: port; cr.
	 Transcript show: 'Interactive Editor: http://localhost:'; show: port; show: '/editor'; cr.
	 Transcript show: 'API Endpoints: /get-content, /update-content'; cr]
	on: Error 
	do: [:ex |
		Transcript show: 'WebServer error: '; show: ex messageText; cr.
		isRunning := false]! !

!C9AIWebServer methodsFor: 'server'!
stop
	isRunning ifFalse: [^ self].
	
	[webServer ifNotNil: [webServer stop].
	 isRunning := false.
	 Transcript show: 'C9AI WebServer stopped'; cr]
	on: Error
	do: [:ex |
		Transcript show: 'Stop error: '; show: ex messageText; cr]! !

!C9AIWebServer methodsFor: 'helpers'!
escapeJSON: text
	"Escape text for JSON"
	| result |
	text ifNil: [^ ''].
	
	result := text copyReplaceAll: '"' with: '\"'.
	result := result copyReplaceAll: String cr with: '\n'.
	^ result! !

!C9AIWebServer methodsFor: 'helpers'!
escapeHTML: text
	"Escape text for HTML"
	| result |
	text ifNil: [^ ''].
	
	result := text copyReplaceAll: '&' with: '&amp;'.
	result := result copyReplaceAll: '<' with: '&lt;'.
	result := result copyReplaceAll: '>' with: '&gt;'.
	result := result copyReplaceAll: '"' with: '&quot;'.
	^ result! !

!C9AIWebServer class methodsFor: 'examples'!
start
	"Start integrated C9AI WebServer"
	| server |
	server := self new.
	server onContentUpdate: [:newContent |
		Transcript show: 'Browser updated content to: '; show: newContent; cr
	].
	server start.
	^ server! !

!C9AIWebServer class methodsFor: 'examples'!
stop
	"Stop the server using WebServer class method"
	WebServer reset stop.
	Transcript show: 'C9AI WebServer stopped'; cr! !