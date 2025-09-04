Object subclass: #C9AILlamaClient
	instanceVariableNames: 'serverUrl'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Core'!

!C9AILlamaClient methodsFor: 'initialization'!
initialize
	super initialize.
	serverUrl := 'http://127.0.0.1:8080'.
	self setupKannadaFont! !

!C9AILlamaClient methodsFor: 'font-setup'!
setupKannadaFont
	"Setup available Kannada font using TextStyle"
	| kannadaStyle |
	
	"Use the found NotoSansKannadaThin from TextStyle"
	[kannadaStyle := TextStyle named: #NotoSansKannadaThin.
	 kannadaStyle ifNotNil: [
		Transcript show: 'Successfully found Kannada font: NotoSansKannadaThin'; cr.
	 ] ifNil: [
		Transcript show: 'Warning: NotoSansKannadaThin not accessible'; cr.
	 ]]
		on: Error
		do: [:ex | 
			Transcript show: 'Font setup error: ', ex messageText; cr]! !

!C9AILlamaClient methodsFor: 'ai-api'!
completion: promptText
	"Send completion using OpenAI-compatible endpoint with UTF-8 support"
	| jsonBody response responseText |
	jsonBody := '{"model":"phi3","messages":[{"role":"system","content":"You are a helpful assistant. Always complete your sentences and thoughts, even when approaching token limits. If you must stop due to length, end with a complete sentence or natural conclusion."},{"role":"user","content":"', promptText, '"}],"max_tokens":500,"stream":false}'.
	
	Transcript show: 'Sending: ', promptText; cr.
	
	[response := HTTPSocket 
		httpPost: serverUrl, '/v1/chat/completions'
		content: jsonBody
		type: 'application/json'
		accept: 'application/json'
		request: nil.
	 
	 responseText := self convertToUTF8String: response.
	 ^ self extractMessageContent: responseText]
		on: Error
		do: [:ex |
			Transcript show: 'API error: ', ex messageText; cr.
			^ 'Error: ', ex messageText]! !

!C9AILlamaClient methodsFor: 'ai-api'!
testHealth
	"Test if the AI server is responding"
	| testPrompt response |
	testPrompt := 'Say hello'.
	
	[response := self completion: testPrompt.
	 ^ (response beginsWith: 'Error:') not]
		on: Error
		do: [:ex | 
			Transcript show: 'Health check failed: ', ex messageText; cr.
			^ false]! !

!C9AILlamaClient methodsFor: 'utf8-support'!
convertToUTF8String: httpResponse
	"Convert HTTP response content to proper UTF-8 string"
	| content bytes |
	
	"Get the raw content"
	content := httpResponse content.
	
	"If it's already a String (and not ByteString), return it"
	content class = String ifTrue: [^ content].
	
	"If it's a ByteString, try to convert to UTF-8"
	content class = ByteString ifTrue: [
		^ self utf8BytesToString: content
	].
	
	"If it's some other type, convert to string"
	^ content asString! !

!C9AILlamaClient methodsFor: 'utf8-support'!
utf8BytesToString: byteString
	"Convert UTF-8 byte sequence to proper Unicode string"
	| stream result |
	
	[stream := ReadStream on: byteString.
	 result := String new writeStream.
	 
	 [stream atEnd] whileFalse: [
		| byte char |
		byte := stream next asInteger.
		
		"ASCII character (0-127)"
		(byte < 128) ifTrue: [
			char := Character value: byte.
			result nextPut: char
		] ifFalse: [
			"Multi-byte UTF-8 sequence"
			char := self parseUTF8Character: stream startingWith: byte.
			char ifNotNil: [result nextPut: char]
		]
	 ].
	 
	 ^ result contents]
		on: Error 
		do: [:ex | 
			"Fallback: return original as string if UTF-8 parsing fails"
			Transcript show: 'UTF-8 parsing failed, using fallback: ', ex messageText; cr.
			^ byteString asString]! !

!C9AILlamaClient methodsFor: 'utf8-support'!
parseUTF8Character: stream startingWith: firstByte
	"Parse a UTF-8 multi-byte character sequence"
	| codePoint bytes numBytes |
	
	"Determine number of bytes based on first byte"
	firstByte < 192 ifTrue: [^ nil].  "Invalid UTF-8"
	firstByte < 224 ifTrue: [numBytes := 2].  "110xxxxx - 2 bytes"
	firstByte < 240 ifTrue: [numBytes := 3].  "1110xxxx - 3 bytes"
	firstByte < 248 ifTrue: [numBytes := 4].  "11110xxx - 4 bytes"
	numBytes ifNil: [^ nil].  "Invalid UTF-8"
	
	"Extract the payload bits from first byte"
	numBytes = 2 ifTrue: [codePoint := firstByte bitAnd: 2r00011111].
	numBytes = 3 ifTrue: [codePoint := firstByte bitAnd: 2r00001111].
	numBytes = 4 ifTrue: [codePoint := firstByte bitAnd: 2r00000111].
	
	"Read continuation bytes"
	2 to: numBytes do: [:i |
		| byte |
		stream atEnd ifTrue: [^ nil].  "Truncated sequence"
		byte := stream next asInteger.
		((byte bitAnd: 2r11000000) = 2r10000000) ifFalse: [^ nil].  "Invalid continuation"
		codePoint := (codePoint bitShift: 6) bitOr: (byte bitAnd: 2r00111111)
	].
	
	"Create character from Unicode code point"
	[^ Character value: codePoint]
		on: Error
		do: [:ex | ^ nil]! !

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

!C9AILlamaClient methodsFor: 'kannada-display'!
createKannadaText: textString
	"Create properly formatted Kannada text morph using TextStyle"
	| textMorph kannadaFont |
	
	[kannadaFont := TextStyle named: #NotoSansKannadaThin.
	 
	 textMorph := TextMorph new.
	 textMorph contents: textString.
	 
	 kannadaFont ifNotNil: [
		"Apply the Kannada font style to the text"
		textMorph textStyle: kannadaFont.
		Transcript show: 'Applied NotoSansKannadaThin font to text'; cr.
	 ] ifNil: [
		Transcript show: 'Could not apply Kannada font, using default'; cr.
	 ].
	 
	 ^ textMorph]
		on: Error
		do: [:ex |
			Transcript show: 'Could not create Kannada text morph: ', ex messageText; cr.
			^ TextMorph new contents: textString]! !

!C9AILlamaClient class methodsFor: 'instance creation'!
new
	^ super new initialize! !

!C9AILlamaClient class methodsFor: 'demo'!
testKannadaWithWorkingFont
	"Test Kannada with the working NotoSansKannadaThin font"
	| client response |
	client := self new.
	Transcript show: '=== Testing Kannada with Working Font ==='; cr.
	response := client completion: 'ಕನ್ನಡ ಭಾಷೆ ಬಗ್ಗೆ ಎರಡು ವಾಕ್ಯಗಳಲ್ಲಿ ಹೇಳಿ'.
	Transcript show: 'Response: ', response; cr.
	^ response! !

!C9AILlamaClient class methodsFor: 'demo'!
showKannadaTextWithFont: textString
	"Display Kannada text using the working font"
	| client textMorph |
	client := self new.
	textMorph := client createKannadaText: textString.
	textMorph openInWorld.
	textMorph extent: 400@200.
	^ textMorph! !

!C9AILlamaClient class methodsFor: 'demo'!
testFont
	"Simple font test"
	^ self showKannadaTextWithFont: 'ಕನ್ನಡ ಭಾಷೆ ಪರೀಕ್ಷೆ - ಇದು ಸರಿಯಾಗಿ ಕಾಣುತ್ತದೆಯೇ?'! !