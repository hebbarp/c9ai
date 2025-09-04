Object subclass: #C9AILlamaClient
	instanceVariableNames: 'serverUrl'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Core'!

!C9AILlamaClient methodsFor: 'initialization'!
initialize
	super initialize.
	serverUrl := 'http://127.0.0.1:8080'! !

!C9AILlamaClient methodsFor: 'ai-api'!
completion: promptText
	"Send completion request and extract content using string parsing"
	| jsonBody response responseText content |
	jsonBody := '{"prompt":"', promptText, '","max_tokens":150,"stream":false}'.
	
	[response := HTTPSocket 
		httpPost: serverUrl, '/completion'
		content: jsonBody
		type: 'application/json'
		accept: 'application/json'
		request: nil.
	 
	 responseText := response content.
	 content := self extractContentFromJSON: responseText.
	 ^ content]
		on: Error
		do: [:ex |
			^ 'Error: ', ex messageText]! !

!C9AILlamaClient methodsFor: 'parsing'!
extractContentFromJSON: jsonString
	"Extract content field from JSON response using string manipulation"
	| startPos endPos content |
	
	"Find the content field"
	startPos := jsonString findString: '"content":"'.
	startPos = 0 ifTrue: [^ 'No content found in response'].
	
	"Move past the opening quote"
	startPos := startPos + 11.
	
	"Find the end of the content (look for ","tokens")"
	endPos := jsonString findString: '","tokens"' startingAt: startPos.
	endPos = 0 ifTrue: [^ 'Could not parse content end'].
	
	"Extract the content"
	content := jsonString copyFrom: startPos to: endPos - 1.
	
	"Clean up escape sequences"
	content := content copyReplaceAll: '\n' with: String cr.
	
	^ content! !

!C9AILlamaClient class methodsFor: 'instance creation'!
new
	^ super new! !

!C9AILlamaClient class methodsFor: 'demo'!
testContentExtraction
	"Test content extraction"
	| client response |
	client := self new.
	response := client completion: 'What is the capital of France?'.
	Transcript show: 'Extracted content: ', response; cr.
	^ response! !