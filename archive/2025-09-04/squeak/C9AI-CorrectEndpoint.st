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
	"Send completion using OpenAI-compatible endpoint"
	| jsonBody response responseText |
	jsonBody := '{"model":"phi3","messages":[{"role":"user","content":"', promptText, '"}],"max_tokens":100,"stream":false}'.
	
	Transcript show: 'Sending to correct endpoint: ', promptText; cr.
	
	[response := HTTPSocket 
		httpPost: serverUrl, '/v1/chat/completions'
		content: jsonBody
		type: 'application/json'
		accept: 'application/json'
		request: nil.
	 
	 responseText := response content.
	 ^ self extractMessageContent: responseText]
		on: Error
		do: [:ex |
			Transcript show: 'API error: ', ex messageText; cr.
			^ 'Error: ', ex messageText]! !

!C9AILlamaClient methodsFor: 'parsing'!
extractMessageContent: jsonString
	"Extract message content from OpenAI-compatible response"
	| startPos endPos content |
	
	startPos := jsonString findString: '"content":"'.
	startPos = 0 ifTrue: [^ 'No content found'].
	
	startPos := startPos + 11.
	
	endPos := jsonString findString: '"}],"created"' startingAt: startPos.
	endPos = 0 ifTrue: [
		endPos := jsonString findString: '","role"' startingAt: startPos.
		endPos = 0 ifTrue: [^ 'Parse error']
	].
	
	content := jsonString copyFrom: startPos to: endPos - 1.
	^ content! !

!C9AILlamaClient class methodsFor: 'instance creation'!
new
	^ super new! !

!C9AILlamaClient class methodsFor: 'demo'!
testCorrect
	"Test with correct endpoint"
	| client response |
	client := self new.
	response := client completion: 'What is 2 plus 2?'.
	Transcript show: 'Correct response: ', response; cr.
	^ response! !