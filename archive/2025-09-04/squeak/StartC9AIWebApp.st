"C9AI Web Application Startup Script"

"Initialize the editor component"
C9AIEditorComponent initialize.

"Create and configure the web application"
app := C9AIWebApplication new.
app port: 8080.

"Register our components"
app register: C9AIEditorComponent at: '/editor'.

"Add API endpoints"
server := app start.

"Add API routes manually to the server"
server addService: '/api/content' action: [:req |
	| content |
	content := C9AIEditorComponent content.
	req sendResponseCode: 200 
		content: '{"content": "' , content , '"}' 
		type: 'application/json' 
		do: []
].

server addService: '/api/save' action: [:req |
	| jsonData content |
	jsonData := req content.
	"Simple JSON parsing - extract content"
	(jsonData includes: $:) ifTrue: [
		content := jsonData copyAfter: $".
		content := content copyUpTo: $".
		C9AIEditorComponent content: content.
		Transcript show: 'Content saved: '; show: content; cr.
	].
	req sendResponseCode: 200 
		content: '{"status": "success"}' 
		type: 'application/json' 
		do: []
].

server addService: '/api/ai-process' action: [:req |
	| jsonData content aiResponse |
	jsonData := req content.
	"Extract content for AI processing"
	(jsonData includes: $:) ifTrue: [
		content := jsonData copyAfter: $".
		content := content copyUpTo: $".
		
		"TODO: Integrate with actual C9AI engine here"
		aiResponse := 'Processed "' , (content copyFrom: 1 to: (content size min: 50)) , 
					  '..." - This would be processed by your C9AI local engine with cloud verification.'.
		
		Transcript show: 'AI processing request: '; show: content; cr.
	].
	
	req sendResponseCode: 200 
		content: '{"response": "' , (aiResponse ifNil: ['AI processing complete']) , '"}' 
		type: 'application/json' 
		do: []
].

"Add root redirect"
server addService: '/' action: [:req |
	req sendResponseCode: 302 
		content: '' 
		type: 'text/html' 
		do: [req addHeader: 'Location' value: '/editor']
].

Transcript show: 'C9AI Web Application started'; cr.
Transcript show: 'Visit: http://localhost:8080/editor'; cr.
Transcript show: 'API endpoints: /api/content, /api/save, /api/ai-process'; cr.