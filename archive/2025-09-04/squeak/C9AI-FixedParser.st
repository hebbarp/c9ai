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
	jsonBody := '{"model":"phi3","messages":[{"role":"system","content":"You are a helpful assistant. Always complete your sentences and thoughts, even when approaching token limits. If you must stop due to length, end with a complete sentence or natural conclusion."},{"role":"user","content":"', promptText, '"}],"max_tokens":500,"stream":false}'.
	
	Transcript show: 'Sending: ', promptText; cr.
	
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
	| startPos endPos content searchStart searchEnd |
	
	"Look for the content field inside the message object"
	searchStart := '"message":{"role":"assistant","content":"'.
	startPos := jsonString findString: searchStart.
	startPos = 0 ifTrue: [^ 'No message content found'].
	
	"Move to start of actual content"
	startPos := startPos + searchStart size.
	
	"Find the end of the content (closing quote before })"
	searchEnd := '"}}'.
	endPos := jsonString findString: searchEnd startingAt: startPos.
	endPos = 0 ifTrue: [^ 'Cannot find content end'].
	
	content := jsonString copyFrom: startPos to: endPos - 1.
	^ content! !

!C9AILlamaClient class methodsFor: 'instance creation'!
new
	^ super new! !

!C9AILlamaClient class methodsFor: 'demo'!
testFixed
	"Test with fixed parser"
	| client response |
	client := self new.
	response := client completion: 'What is your name?'.
	Transcript show: 'Fixed response: ', response; cr.
	^ response! !