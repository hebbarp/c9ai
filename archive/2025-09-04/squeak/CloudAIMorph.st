Morph subclass: #CloudAIMorph
	instanceVariableNames: 'titleMorph queryMorph providerSelector providerButton checkButton resultMorph comparisonHistory scrollPane selectedProvider'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!CloudAIMorph commentStamp: 'C9AI 8/24/2025 17:45' prior: 0!
CloudAIMorph integrates with cloud AI services for cross-checking local AI responses.
Compares responses from different AI providers to detect inconsistencies and verify accuracy.
Supports multiple cloud AI services with API integration.

Usage:
  CloudAIMorph new openInWorld.
  CloudAIMorph checkQuery: 'who founded Apple' localAnswer: 'Steve Jobs and Steve Wozniak'.!

!CloudAIMorph methodsFor: 'initialization'!
initialize
	super initialize.
	comparisonHistory := OrderedCollection new.
	selectedProvider := #mock.
	self setupAppearance.
	self buildInterface.
	self enableDragging! !

!CloudAIMorph methodsFor: 'initialization'!
setupAppearance
	self color: (Color r: 0.95 g: 0.95 b: 1.0).
	self borderWidth: 2.
	self borderColor: (Color r: 0.2 g: 0.4 b: 0.8).
	self extent: 420@380.
	self layoutPolicy: TableLayout new.
	self listDirection: #topToBottom.
	self cellPositioning: #topLeft.
	self hResizing: #spaceFill.
	self vResizing: #spaceFill.
	self layoutInset: 8! !

!CloudAIMorph methodsFor: 'interface'!
buildInterface
	self removeAllMorphs.
	
	titleMorph := self buildTitle.
	queryMorph := self buildQueryInput.
	providerSelector := self buildProviderSelector.
	checkButton := self buildCheckButton.
	scrollPane := self buildResultPane.
	
	self addMorphBack: titleMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: queryMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: providerSelector.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: checkButton.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: scrollPane! !

!CloudAIMorph methodsFor: 'interface'!
buildTitle
	| title |
	title := StringMorph new
		contents: 'Cloud AI Cross-Check';
		color: (Color r: 0.1 g: 0.3 b: 0.7).
	^ title! !

!CloudAIMorph methodsFor: 'interface'!
buildQueryInput
	| input |
	input := PluggableTextMorph new
		extent: 380@40;
		color: Color white;
		borderWidth: 1;
		borderColor: Color gray;
		hResizing: #spaceFill;
		vResizing: #rigid.
	^ input! !

!CloudAIMorph methodsFor: 'interface'!
buildProviderSelector
	| container label |
	
	container := Morph new
		color: Color transparent;
		layoutPolicy: TableLayout new;
		listDirection: #leftToRight;
		cellPositioning: #center;
		hResizing: #spaceFill;
		vResizing: #rigid;
		extent: 380@30.
	
	label := StringMorph new
		contents: 'Provider: ';
		color: (Color r: 0.3 g: 0.3 b: 0.3).
	
	providerButton := SimpleButtonMorph new
		label: 'Mock (Testing)';
		target: self;
		actionSelector: #selectProvider;
		color: (Color r: 1.0 g: 0.95 b: 0.9);
		extent: 120@25.
	
	container addMorphBack: label.
	container addMorphBack: (self buildSpacer: 8).
	container addMorphBack: providerButton.
	
	^ container! !

!CloudAIMorph methodsFor: 'interface'!
buildCheckButton
	| button |
	button := SimpleButtonMorph new
		label: 'Cross-Check with Cloud AI';
		target: self;
		actionSelector: #performCloudCheck;
		color: (Color r: 0.2 g: 0.4 b: 0.8);
		extent: 180@25.
	^ button! !

!CloudAIMorph methodsFor: 'interface'!
buildResultPane
	| pane |
	pane := ScrollPane new
		extent: 380@240;
		color: Color white;
		borderWidth: 1;
		borderColor: Color gray;
		hResizing: #spaceFill;
		vResizing: #spaceFill.
	
	resultMorph := self buildResultMorph.
	pane scroller addMorph: resultMorph.
	^ pane! !

!CloudAIMorph methodsFor: 'interface'!
buildResultMorph
	| result |
	result := PluggableTextMorph new
		extent: 360@220;
		setText: 'Enter a query and click Cross-Check to compare AI responses.';
		color: Color white;
		borderWidth: 0;
		readOnly: true;
		wrapFlag: true;
		hResizing: #spaceFill;
		vResizing: #shrinkWrap.
	^ result! !

!CloudAIMorph methodsFor: 'interface'!
buildSpacer: height
	"Create a transparent spacer morph"
	^ Morph new
		color: Color transparent;
		extent: 1@height;
		hResizing: #rigid;
		vResizing: #rigid! !

!CloudAIMorph methodsFor: 'cloud-ai'!
performCloudCheck
	"Perform cloud AI cross-check with the entered query"
	| queryText |
	queryText := queryMorph text asString.
	queryText isEmpty ifTrue: [
		^ self showMessage: 'Enter a query first'].
	
	self showMessage: 'Checking with cloud AI...'.
	checkButton color: Color orange.
	
	[self checkQueryWithCloudAI: queryText.
	 checkButton color: (Color r: 0.2 g: 0.4 b: 0.8)] fork! !

!CloudAIMorph methodsFor: 'cloud-ai'!
checkQueryWithCloudAI: queryText
	"Cross-check query with selected cloud AI provider only"
	| cloudResponse comparisonResult providerName |
	
	providerName := self getProviderDisplayName: selectedProvider.
	self showStatus: 'Querying ', providerName, ' for: ', queryText.
	
	Transcript show: '=== CloudAI Check Starting ==='; cr.
	Transcript show: 'Selected Provider: ', selectedProvider printString; cr.
	Transcript show: 'Query: ', queryText; cr.
	Transcript show: '==============================='; cr.
	
	"Execute ONLY the selected provider"
	selectedProvider = #mock ifTrue: [
		cloudResponse := self tryMockCloudResponse: queryText].
	
	selectedProvider = #openaiWebClient ifTrue: [
		cloudResponse := self tryOpenAIWebClientOnly: queryText].
	
	selectedProvider = #openaiHTTPSocket ifTrue: [
		cloudResponse := self tryOpenAIHTTPSocketOnly: queryText].
	
	selectedProvider = #claude ifTrue: [
		cloudResponse := self tryClaudeAPI: queryText].
	
	"If no response, create error message"
	cloudResponse ifNil: [
		cloudResponse := 'ERROR: No response from ', providerName, '. Check API keys and connectivity.'].
	
	"Create comparison result"
	comparisonResult := self formatCloudComparison: queryText response: cloudResponse.
	
	"Store in history"
	self addToHistory: queryText cloudResponse: cloudResponse.
	
	"Update display"
	self showResults: comparisonResult! !

!CloudAIMorph methodsFor: 'provider-utilities'!
getProviderDisplayName: provider
	"Get display name for provider"
	provider = #mock ifTrue: [^ 'Mock AI'].
	provider = #openaiWebClient ifTrue: [^ 'OpenAI WebClient'].
	provider = #openaiHTTPSocket ifTrue: [^ 'OpenAI HTTPSocket'].
	provider = #claude ifTrue: [^ 'Claude HTTPSocket'].
	^ 'Unknown Provider'! !

!CloudAIMorph methodsFor: 'api-integration'!
tryOpenAIWebClientOnly: queryText
	"Try querying OpenAI GPT API using WebClient ONLY"
	| webClient response body httpUrl |
	
	[
		Transcript show: 'DEBUG: Attempting OpenAI WebClient API call'; cr.
		
		"Check if WebClient is available"
		webClient := Smalltalk at: #WebClient ifAbsent: [
			Transcript show: 'DEBUG: WebClient not available in this Squeak image'; cr.
			^ 'WebClient class not found in this Squeak image'].
		
		Transcript show: 'DEBUG: WebClient class found, creating instance'; cr.
		webClient := webClient new.
		
		"Build request"
		body := self buildOpenAIRequestBody: queryText.
		httpUrl := 'https://api.openai.com/v1/chat/completions'.
		
		Transcript show: 'DEBUG: Request body: ', (body copyFrom: 1 to: (100 min: body size)); cr.
		Transcript show: 'DEBUG: Request URL: ', httpUrl; cr.
		
		"Try to explore WebClient API"
		Transcript show: 'DEBUG: WebClient instance methods: ', webClient class selectors printString; cr.
		
		"Try different approaches to set headers and make request"
		[
			Transcript show: 'DEBUG: Trying approach 1 - headerAt:put: then httpPost:content:type:'; cr.
			webClient headerAt: 'Authorization' put: 'Bearer ', self getOpenAIApiKey.
			webClient headerAt: 'Content-Type' put: 'application/json'.
			webClient headerAt: 'User-Agent' put: 'SqueakCloudAIMorph/1.0'.
			response := webClient httpPost: httpUrl content: body type: 'application/json'.
		] on: Error do: [:ex1 |
			Transcript show: 'DEBUG: Approach 1 failed: ', ex1 messageText; cr.
			[
				Transcript show: 'DEBUG: Trying approach 2 - simple httpPost:content:'; cr.
				response := webClient httpPost: httpUrl content: body.
			] on: Error do: [:ex2 |
				Transcript show: 'DEBUG: Approach 2 failed: ', ex2 messageText; cr.
				[
					Transcript show: 'DEBUG: Trying approach 3 - httpGet to test basic connectivity'; cr.
					response := webClient httpGet: 'https://httpbin.org/get'.
					Transcript show: 'DEBUG: Basic GET worked, response: ', (response copyFrom: 1 to: (100 min: response size)); cr.
					^ 'WebClient connectivity test successful, but POST API unclear. Response: ', response.
				] on: Error do: [:ex3 |
					Transcript show: 'DEBUG: All approaches failed. Final error: ', ex3 messageText; cr.
					^ 'WebClient API incompatible - all methods failed: ', ex3 messageText]]]].
		
		Transcript show: 'DEBUG: WebClient request succeeded'; cr.
		Transcript show: 'DEBUG: Response class: ', response class name; cr.
		Transcript show: 'DEBUG: Response content: ', (response copyFrom: 1 to: (200 min: response size)); cr.
		
		"WebClient typically returns the response body directly"
		^ self parseOpenAIResponse: response.
		
	] on: Error do: [:ex |
		Transcript show: 'DEBUG: Outer exception: ', ex messageText; cr.
		^ 'OpenAI WebClient Exception: ', ex messageText].
	
	^ nil! !

!CloudAIMorph methodsFor: 'api-integration'!
tryOpenAIHTTPSocketOnly: queryText
	"Try querying OpenAI using HTTPSocket approach ONLY"
	| socket response url headers body |
	
	[
		Transcript show: 'DEBUG: Attempting OpenAI HTTPSocket API call'; cr.
		
		"This is the HTTPSocket-based approach"
		url := '/v1/chat/completions'.
		
		"Create HTTPS connection to OpenAI"
		socket := self createHttpsSocket: 'api.openai.com' port: 443.
		socket ifNil: [
			Transcript show: 'DEBUG: Failed to create HTTPS socket to api.openai.com'; cr.
			^ 'Failed to create HTTPS connection to OpenAI'].
		
		"Build request body"
		body := self buildOpenAIRequestBody: queryText.
		headers := self buildOpenAIHeaders: body.
		
		"Send HTTPS request"
		response := self sendHttpsRequest: socket 
			url: url 
			host: 'api.openai.com' 
			headers: headers 
			body: body.
		socket close.
		
		response ifNil: [
			Transcript show: 'DEBUG: HTTPSocket response is nil'; cr.
			^ 'No response from OpenAI HTTPSocket'].
		
		response isEmpty ifTrue: [
			Transcript show: 'DEBUG: HTTPSocket response is empty'; cr.
			^ 'Empty response from OpenAI HTTPSocket'].
		
		Transcript show: 'DEBUG: HTTPSocket response received (length: ', response size printString, ')'; cr.
		Transcript show: 'DEBUG: HTTPSocket response content: ', (response copyFrom: 1 to: (200 min: response size)); cr.
		
		Transcript show: 'DEBUG: About to call parseOpenAIResponse with HTTPSocket response'; cr.
		^ self parseOpenAIResponse: response.
		
	] on: Error do: [:ex |
		Transcript show: 'DEBUG: HTTPSocket error: ', ex messageText; cr.
		socket ifNotNil: [socket close].
		^ 'OpenAI HTTPSocket Exception: ', ex messageText].
	
	^ nil! !

!CloudAIMorph methodsFor: 'api-integration'!
tryOpenAIWithHTTPSocket: queryText
	"Fallback to HTTPSocket approach"
	| socket response url headers body |
	
	[
		"This is the original socket-based approach as fallback"
		url := '/v1/chat/completions'.
		
		"Create HTTPS connection to OpenAI"
		socket := self createHttpsSocket: 'api.openai.com' port: 443.
		socket ifNil: [
			Transcript show: 'DEBUG: Failed to create HTTPS socket to api.openai.com'; cr.
			^ nil].
		
		"Build request body"
		body := self buildOpenAIRequestBody: queryText.
		headers := self buildOpenAIHeaders: body.
		
		"Send HTTPS request"
		response := self sendHttpsRequest: socket 
			url: url 
			host: 'api.openai.com' 
			headers: headers 
			body: body.
		socket close.
		
		response ifNil: [
			Transcript show: 'DEBUG: HTTPSocket response is nil'; cr.
			^ nil].
		
		response isEmpty ifTrue: [
			Transcript show: 'DEBUG: HTTPSocket response is empty'; cr.
			^ nil].
		
		Transcript show: 'DEBUG: HTTPSocket response received (length: ', response size printString, ')'; cr.
		Transcript show: 'DEBUG: HTTPSocket response content: ', (response copyFrom: 1 to: (200 min: response size)); cr.
		
		Transcript show: 'DEBUG: About to call parseOpenAIResponse with HTTPSocket response'; cr.
		^ self parseOpenAIResponse: response.
		
	] on: Error do: [:ex |
		Transcript show: 'DEBUG: HTTPSocket error: ', ex messageText; cr.
		socket ifNotNil: [socket close].
		^ nil].
	
	^ nil! !

!CloudAIMorph methodsFor: 'api-integration'!
tryClaudeAPI: queryText
	"Try querying Anthropic Claude API"
	| socket response url headers body |
	
	[
		"Claude API endpoint"
		url := '/v1/messages'.
		
		"Create HTTPS connection to Claude"
		socket := self createHttpsSocket: 'api.anthropic.com' port: 443.
		socket ifNil: [^ nil].
		
		"Build request body"
		body := self buildClaudeRequestBody: queryText.
		headers := self buildClaudeHeaders: body.
		
		"Send HTTPS request"
		response := self sendHttpsRequest: socket 
			url: url 
			host: 'api.anthropic.com' 
			headers: headers 
			body: body.
		socket close.
		
		response ifNotNil: [
			^ self parseClaudeResponse: response].
		
	] on: Error do: [:ex |
		socket ifNotNil: [socket close].
		^ nil].
	
	^ nil! !

!CloudAIMorph methodsFor: 'http-utilities'!
createHttpsSocket: hostname port: portNumber
	"Create and connect an HTTPS socket using Squeak's SSL support"
	| socket address sslSocket |
	
	[
		"First create regular socket"
		socket := Socket new.
		address := NetNameResolver addressForName: hostname timeout: 10.
		address ifNil: [^ nil].
		
		socket connectTo: address port: portNumber.
		socket waitForConnectionFor: 10.
		socket isConnected ifFalse: [^ nil].
		
		"Wrap with SSL if available"
		sslSocket := self wrapWithSSL: socket hostname: hostname.
		sslSocket ifNotNil: [^ sslSocket].
		
		"Fallback to plain socket if SSL fails"
		^ socket
		
	] on: Error do: [:ex |
		socket ifNotNil: [socket close].
		^ nil]! !

!CloudAIMorph methodsFor: 'http-utilities'!
wrapWithSSL: socket hostname: hostname
	"Wrap socket with SSL using Squeak's SSL support"
	| sslSocket |
	
	[
		"Try to create SSL socket wrapper"
		sslSocket := (Smalltalk at: #SqueakSSL ifAbsent: [^ nil]) newClient.
		sslSocket ifNil: [^ nil].
		
		"Configure SSL"
		sslSocket socket: socket.
		sslSocket serverName: hostname.
		sslSocket connect.
		
		^ sslSocket
		
	] on: Error do: [:ex |
		"SSL failed, return nil to use plain socket"
		^ nil]! !

!CloudAIMorph methodsFor: 'http-utilities'!
sendHttpsRequest: socket url: urlString host: hostString headers: headerString body: bodyString
	"Send HTTPS POST request with JSON body"
	| request response |
	
	[
		request := 'POST ', urlString, ' HTTP/1.1', String cr,
			'Host: ', hostString, String cr,
			headerString,
			'Connection: close', String cr, String cr,
			bodyString.
		
		socket sendData: request.
		response := self readHttpResponse: socket.
		^ response
		
	] on: Error do: [:ex |
		^ nil]! !

!CloudAIMorph methodsFor: 'http-utilities'!
readHttpResponse: socket
	"Read HTTP response from socket with aggressive data collection"
	| response data chunkCount totalWaitTime maxWaitTime |
	
	[
		Transcript show: 'DEBUG: readHttpResponse starting...'; cr.
		response := String new.
		chunkCount := 0.
		totalWaitTime := 0.
		maxWaitTime := 30. "seconds"
		
		"Read all available data immediately first"
		[socket dataAvailable] whileTrue: [
			data := socket receiveData.
			data ifNotNil: [
				chunkCount := chunkCount + 1.
				Transcript show: 'DEBUG: Initial chunk #', chunkCount printString, ' (size: ', data size printString, ')'; cr.
				response := response, data]].
		
		"Then wait for more data with shorter timeouts"
		[totalWaitTime < maxWaitTime and: [socket isConnected]] whileTrue: [
			socket waitForDataFor: 1.
			socket dataAvailable ifTrue: [
				data := socket receiveData.
				data ifNotNil: [
					chunkCount := chunkCount + 1.
					Transcript show: 'DEBUG: Additional chunk #', chunkCount printString, ' (size: ', data size printString, ')'; cr.
					response := response, data]]
			ifFalse: [
				totalWaitTime := totalWaitTime + 1.
				Transcript show: 'DEBUG: Waiting for more data... (', totalWaitTime printString, '/', maxWaitTime printString, 's)'; cr]].
		
		Transcript show: 'DEBUG: Final response length: ', response size printString; cr.
		Transcript show: 'DEBUG: Total chunks received: ', chunkCount printString; cr.
		Transcript show: 'DEBUG: Socket still connected: ', socket isConnected printString; cr.
		
		"Show first part of response for debugging"
		response size > 0 ifTrue: [
			Transcript show: 'DEBUG: Response preview: ', (response copyFrom: 1 to: (300 min: response size)); cr].
		
		response isEmpty ifTrue: [
			Transcript show: 'DEBUG: No response data received from socket'; cr.
			^ nil].
		
		^ response
		
	] on: Error do: [:ex |
		Transcript show: 'DEBUG: Exception in readHttpResponse: ', ex messageText; cr.
		Transcript show: 'DEBUG: Current response length when error occurred: ', response size printString; cr.
		"Return partial response if we got any data"
		response size > 0 ifTrue: [^ response].
		^ nil]! !

!CloudAIMorph methodsFor: 'request-building'!
buildOpenAIRequestBody: queryText
	"Build OpenAI API request body"
	^ '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"', 
		(self escapeJsonString: queryText), 
		'"}],"max_tokens":200,"temperature":0.7}'! !

!CloudAIMorph methodsFor: 'request-building'!
buildClaudeRequestBody: queryText
	"Build Claude API request body"
	^ '{"model":"claude-3-haiku-20240307","max_tokens":200,"messages":[{"role":"user","content":"', 
		(self escapeJsonString: queryText), 
		'"}]}'! !

!CloudAIMorph methodsFor: 'request-building'!
buildOpenAIHeaders: bodyString
	"Build OpenAI API headers"
	| apiKey |
	apiKey := self getOpenAIApiKey.
	^ 'Content-Type: application/json', String cr,
		'Authorization: Bearer ', apiKey, String cr,
		'User-Agent: SqueakCloudAIMorph/1.0', String cr,
		'Content-Length: ', bodyString size printString, String cr! !

!CloudAIMorph methodsFor: 'request-building'!
buildClaudeHeaders: bodyString
	"Build Claude API headers"
	| apiKey |
	apiKey := self getClaudeApiKey.
	^ 'Content-Type: application/json', String cr,
		'x-api-key: ', apiKey, String cr,
		'anthropic-version: 2023-06-01', String cr,
		'User-Agent: SqueakCloudAIMorph/1.0', String cr,
		'Content-Length: ', bodyString size printString, String cr! !

!CloudAIMorph methodsFor: 'request-building'!
escapeJsonString: text
	"Escape string for JSON"
	| escaped |
	escaped := text.
	escaped := escaped copyReplaceAll: '\' with: '\\'.
	escaped := escaped copyReplaceAll: '"' with: '\"'.
	escaped := escaped copyReplaceAll: String cr with: '\n'.
	^ escaped! !

!CloudAIMorph methodsFor: 'response-parsing'!
parseOpenAIResponse: response
	"Parse OpenAI API response with comprehensive error handling"
	| contentStart contentEnd content |
	
	[
		Transcript show: 'DEBUG: parseOpenAIResponse called with response type: ', response class name; cr.
		
		response ifNil: [
			Transcript show: 'DEBUG: parseOpenAIResponse received nil response'; cr.
			^ 'No response from OpenAI API'].
		
		response isEmpty ifTrue: [
			Transcript show: 'DEBUG: parseOpenAIResponse received empty response'; cr.
			^ 'Empty response from OpenAI API'].
		
		Transcript show: 'DEBUG: Response length: ', response size printString; cr.
		Transcript show: 'DEBUG: Parsing OpenAI response (first 200 chars): ', (response copyFrom: 1 to: (200 min: response size)); cr.
		
		"Look for error in response first"
		(response includesSubstring: '"error"') ifTrue: [
			Transcript show: 'DEBUG: Found error field in response'; cr.
			^ 'OpenAI API Error: ', response].
		
		"Look for content field in response"
		Transcript show: 'DEBUG: Looking for content field...'; cr.
		contentStart := response findString: '"content":"'.
		contentStart = 0 ifTrue: [
			Transcript show: 'DEBUG: No content field found, looking for HTTP body...'; cr.
			^ self parseHttpBodyFromResponse: response].
		
		Transcript show: 'DEBUG: Content field found at position: ', contentStart printString; cr.
		contentStart := contentStart + 11.
		contentEnd := response findString: '"' startingAt: contentStart.
		contentEnd = 0 ifTrue: [
			Transcript show: 'DEBUG: Could not find end quote for content'; cr.
			^ 'Could not find end of content in OpenAI response. Response: ', response].
		
		Transcript show: 'DEBUG: Content end found at position: ', contentEnd printString; cr.
		content := response copyFrom: contentStart to: contentEnd - 1.
		Transcript show: 'DEBUG: Extracted content: ', content; cr.
		
		^ content isEmpty 
			ifTrue: ['Empty content from OpenAI'] 
			ifFalse: [content]
		
	] on: Error do: [:ex |
		Transcript show: 'DEBUG: Exception in parseOpenAIResponse: ', ex messageText; cr.
		Transcript show: 'DEBUG: Exception class: ', ex class name; cr.
		^ 'Error parsing OpenAI response: ', ex messageText]! !

!CloudAIMorph methodsFor: 'response-parsing'!
parseHttpBodyFromResponse: response
	"Extract JSON body from HTTP response"
	| bodyStart httpBody |
	
	[
		Transcript show: 'DEBUG: parseHttpBodyFromResponse called'; cr.
		
		"Look for double CRLF that separates headers from body"
		bodyStart := response findString: String cr, String cr.
		bodyStart = 0 ifTrue: [
			Transcript show: 'DEBUG: No HTTP body separator found'; cr.
			^ 'HTTP response format error - no body separator found'].
		
		bodyStart := bodyStart + 2.
		httpBody := response copyFrom: bodyStart to: response size.
		
		Transcript show: 'DEBUG: HTTP body extracted (length: ', httpBody size printString, ')'; cr.
		Transcript show: 'DEBUG: HTTP body content: ', (httpBody copyFrom: 1 to: (100 min: httpBody size)); cr.
		
		"Now try to parse the JSON body"
		^ self parseJsonContent: httpBody
		
	] on: Error do: [:ex |
		Transcript show: 'DEBUG: Exception in parseHttpBodyFromResponse: ', ex messageText; cr.
		^ 'Error parsing HTTP body: ', ex messageText]! !

!CloudAIMorph methodsFor: 'response-parsing'!
parseJsonContent: jsonText
	"Parse JSON content for OpenAI response"
	| contentStart contentEnd content |
	
	[
		Transcript show: 'DEBUG: parseJsonContent called'; cr.
		
		"Look for content field in JSON"
		contentStart := jsonText findString: '"content":"'.
		contentStart = 0 ifTrue: [
			Transcript show: 'DEBUG: No content field in JSON, returning full body'; cr.
			^ 'OpenAI API response (no content field): ', jsonText].
		
		contentStart := contentStart + 11.
		contentEnd := jsonText findString: '"' startingAt: contentStart.
		contentEnd = 0 ifTrue: [
			^ 'Could not find end of content in JSON'].
		
		content := jsonText copyFrom: contentStart to: contentEnd - 1.
		^ content isEmpty 
			ifTrue: ['Empty content from JSON'] 
			ifFalse: [content]
			
	] on: Error do: [:ex |
		Transcript show: 'DEBUG: Exception in parseJsonContent: ', ex messageText; cr.
		^ 'Error parsing JSON content: ', ex messageText]! !

!CloudAIMorph methodsFor: 'response-parsing'!
parseClaudeResponse: response
	"Parse Claude API response"
	| contentStart contentEnd content |
	
	"Look for text field in Claude response"
	contentStart := response findString: '"text":"'.
	contentStart = 0 ifTrue: [
		^ 'Claude API response received but could not parse content'].
	
	contentStart := contentStart + 8.
	contentEnd := response findString: '"' startingAt: contentStart.
	contentEnd = 0 ifTrue: [
		^ 'Could not find end of content in Claude response'].
	
	content := response copyFrom: contentStart to: contentEnd - 1.
	^ content isEmpty 
		ifTrue: ['Empty response from Claude'] 
		ifFalse: [content]! !

!CloudAIMorph methodsFor: 'cloud-fallback'!
tryMockCloudResponse: queryText
	"Provide mock cloud AI response for testing UI"
	| mockResponses |
	
	"Collection of mock responses for testing"
	mockResponses := Dictionary new.
	mockResponses at: 'dale carnegie' put: 'Dale Carnegie (1888-1955) was an American writer and lecturer, best known for his book "How to Win Friends and Influence People" (1936). He developed courses in self-improvement, salesmanship, corporate training, public speaking, and interpersonal skills.'.
	mockResponses at: '3m' put: '3M was founded in 1902 by Henry S. Bryan, Hermon W. Cable, John Dwan, William A. McGonagle, and Dr. J. Danley Budd in Two Harbors, Minnesota as the Minnesota Mining and Manufacturing Company.'.
	mockResponses at: 'apple' put: 'Apple Inc. was founded by Steve Jobs, Steve Wozniak, and Ronald Wayne on April 1, 1976, in Los Altos, California.'.
	
	"Find matching response"
	mockResponses keysDo: [:key |
		(queryText asLowercase includesSubstring: key) ifTrue: [
			^ '[MOCK CLOUD AI RESPONSE FOR TESTING]', String cr, String cr,
				mockResponses at: key]].
	
	"Default mock response"
	^ '[MOCK CLOUD AI RESPONSE FOR TESTING]', String cr, String cr,
		'This is a simulated cloud AI response to test the comparison interface. In a real deployment with proper HTTPS/SSL support, this would be a response from OpenAI GPT or Anthropic Claude.'! !

!CloudAIMorph methodsFor: 'cloud-fallback'!
createNoCloudAIMessage: queryText
	"Create message when no cloud AI is available"
	^ 'CLOUD AI CHECK ATTEMPTED for: "', queryText, '"', String cr, String cr,
		'Unable to connect to cloud AI services. This could be due to:', String cr,
		'- Missing API keys (OpenAI, Anthropic Claude)', String cr,
		'- Network connectivity issues', String cr,
		'- API rate limits or service unavailability', String cr,
		'- HTTPS/SSL connection requirements', String cr, String cr,
		'To enable cloud AI cross-checking:', String cr,
		'1. Get OpenAI API key from: https://platform.openai.com/api-keys', String cr,
		'2. Get Anthropic API key from: https://console.anthropic.com/', String cr,
		'3. Configure SSL/TLS support in Squeak', String cr,
		'4. Update API key placeholders in CloudAIMorph methods', String cr, String cr,
		'Cloud AI cross-checking helps identify:', String cr,
		'- Response inconsistencies between AI models', String cr,
		'- Potential hallucinations or factual errors', String cr,
		'- Confidence levels across different AI systems'! !

!CloudAIMorph methodsFor: 'comparison'!
formatCloudComparison: queryText response: cloudResponse
	"Format comparison between local and cloud AI responses"
	| separator separator2 |
	separator := String new: 35 withAll: $=.
	separator2 := String new: 20 withAll: $-.
	
	^ 'CLOUD AI CROSS-CHECK RESULTS', String cr,
		separator, String cr, String cr,
		'QUERY: ', queryText, String cr, String cr,
		'CLOUD AI RESPONSE:', String cr,
		separator2, String cr,
		cloudResponse, String cr, String cr,
		'COMPARISON NOTES:', String cr,
		'- Compare this with your local AI response', String cr,
		'- Look for factual discrepancies', String cr,
		'- Consider different AI model strengths', String cr,
		'- Cross-reference with web search results', String cr, String cr,
		'Timestamp: ', DateAndTime now asString! !

!CloudAIMorph methodsFor: 'actions'!
selectProvider
	"Cycle through available AI providers"
	| currentLabel newLabel newColor newProvider |
	currentLabel := providerButton label.
	
	currentLabel = 'Mock (Testing)' ifTrue: [
		newLabel := 'OpenAI WebClient'.
		newColor := (Color r: 0.9 g: 0.9 b: 1.0).
		newProvider := #openaiWebClient].
	
	currentLabel = 'OpenAI WebClient' ifTrue: [
		newLabel := 'OpenAI HTTPSocket'.
		newColor := (Color r: 0.8 g: 0.9 b: 1.0).
		newProvider := #openaiHTTPSocket].
	
	currentLabel = 'OpenAI HTTPSocket' ifTrue: [
		newLabel := 'Claude HTTPSocket'.
		newColor := (Color r: 0.9 g: 1.0 b: 0.9).
		newProvider := #claude].
	
	currentLabel = 'Claude HTTPSocket' ifTrue: [
		newLabel := 'Mock (Testing)'.
		newColor := (Color r: 1.0 g: 0.95 b: 0.9).
		newProvider := #mock].
	
	"Default case"
	newLabel ifNil: [
		newLabel := 'Mock (Testing)'.
		newColor := (Color r: 1.0 g: 0.95 b: 0.9).
		newProvider := #mock].
	
	selectedProvider := newProvider.
	providerButton label: newLabel.
	providerButton color: newColor.
	
	self showMessage: 'Selected: ', newLabel! !

!CloudAIMorph methodsFor: 'history'!
addToHistory: queryText cloudResponse: responseText
	"Add comparison to history"
	comparisonHistory add: (Dictionary new
		at: #query put: queryText;
		at: #cloudResponse put: responseText;
		at: #timestamp put: DateAndTime now;
		yourself).
	
	"Log to transcript"
	Transcript show: '=== Cloud AI Check ==='; cr.
	Transcript show: 'Query: ', queryText; cr.
	Transcript show: 'Response: ', (responseText copyFrom: 1 to: (100 min: responseText size)), '...'; cr.
	Transcript show: '====================='; cr! !

!CloudAIMorph methodsFor: 'display'!
showResults: resultsText
	"Display comparison results"
	resultMorph setText: resultsText.
	scrollPane changed.
	self showMessage: 'Cloud AI check completed'! !

!CloudAIMorph methodsFor: 'display'!
showStatus: statusText
	"Show checking status"
	resultMorph setText: 'STATUS: ', statusText, String cr, String cr, 
		'Contacting cloud AI services for cross-verification...'.
	scrollPane changed! !

!CloudAIMorph methodsFor: 'feedback'!
showMessage: messageText
	"Show a temporary message in the title"
	| originalContents |
	originalContents := titleMorph contents.
	titleMorph contents: messageText.
	titleMorph color: Color blue.
	
	"Reset after 3 seconds"
	[(Delay forSeconds: 3) wait.
	 titleMorph contents: originalContents.
	 titleMorph color: (Color r: 0.1 g: 0.3 b: 0.7)]
		fork! !

!CloudAIMorph methodsFor: 'accessing'!
setQueryText: queryText
	"Set the query text"
	queryMorph setText: queryText! !

!CloudAIMorph methodsFor: 'api-keys'!
getOpenAIApiKey
	"Get OpenAI API key from environment or settings"
	| key |
	
	"Try environment variable first"
	key := self getEnvironmentVariable: 'OPENAI_API_KEY'.
	key ifNotNil: [^ key].
	
	"Try settings file"
	key := self getApiKeyFromSettings: 'openai'.
	key ifNotNil: [^ key].
	
	"Return placeholder if no key found"
	^ 'YOUR_OPENAI_API_KEY_HERE'! !

!CloudAIMorph methodsFor: 'api-keys'!
getClaudeApiKey
	"Get Claude API key from environment or settings"
	| key |
	
	"Try environment variable first"
	key := self getEnvironmentVariable: 'ANTHROPIC_API_KEY'.
	key ifNotNil: [^ key].
	
	"Try settings file"
	key := self getApiKeyFromSettings: 'anthropic'.
	key ifNotNil: [^ key].
	
	"Return placeholder if no key found"
	^ 'YOUR_ANTHROPIC_API_KEY_HERE'! !

!CloudAIMorph methodsFor: 'api-keys'!
getEnvironmentVariable: varName
	"Get environment variable if OSProcess is available"
	[
		^ (Smalltalk at: #OSProcess ifAbsent: [^ nil]) 
			thisOSProcess environment 
			at: varName 
			ifAbsent: [nil]
	] on: Error do: [:ex | ^ nil]! !

!CloudAIMorph methodsFor: 'api-keys'!
getApiKeyFromSettings: provider
	"Get API key from .env file"
	| fullPath content lines file dotChar envVarName |
	
	[
		"Try to read .env file from /Users/hebbarp"
		dotChar := String with: $..
		fullPath := '/Users/hebbarp/', dotChar, 'env'.
		(FileStream isAFileNamed: fullPath) ifFalse: [^ nil].
		
		file := FileStream readOnlyFileNamed: fullPath.
		content := file contents.
		file close.
		
		lines := content findTokens: String cr.
		
		"Convert provider name to environment variable name"
		envVarName := provider = 'openai' 
			ifTrue: ['OPENAI_API_KEY'] 
			ifFalse: ['ANTHROPIC_API_KEY'].
		
		lines do: [:line |
			(line includesSubstring: envVarName) ifTrue: [
				| parts |
				parts := line findTokens: '='.
				parts size >= 2 ifTrue: [
					^ (parts at: 2) copyReplaceAll: ' ' with: '']]]
		
	] on: Error do: [:ex | ^ nil].
	
	^ nil! !

!CloudAIMorph methodsFor: 'api-keys'!
createSettingsFileTemplate
	"Create a template settings file for API keys"
	| filename content lines commentChar file fullPath dotChar |
	
	"Create .env file in /Users/hebbarp (dot is special character in Smalltalk)"
	dotChar := String with: $..
	fullPath := '/Users/hebbarp/', dotChar, 'env'.
	filename := dotChar, 'env'.
	commentChar := String with: $;.
	
	"Build .env content line by line using semicolon comments (safe for Smalltalk)"
	lines := OrderedCollection new.
	lines add: commentChar, ' C9AI Environment Variables'.
	lines add: commentChar, ' Add your API keys below (uncomment and replace values)'.
	lines add: commentChar, ' Keep this file secure and do not commit to version control'.
	lines add: ''.
	lines add: commentChar, ' OpenAI API Key (get from: https://platform.openai.com/api-keys)'.
	lines add: commentChar, 'OPENAI_API_KEY=sk-your-openai-key-here'.
	lines add: ''.
	lines add: commentChar, ' Anthropic Claude API Key (get from: https://console.anthropic.com/)'.
	lines add: commentChar, 'ANTHROPIC_API_KEY=sk-ant-your-claude-key-here'.
	lines add: ''.
	lines add: commentChar, ' Usage: Remove the semicolon and replace with your actual keys'.
	lines add: commentChar, ' Example: OPENAI_API_KEY=sk-abc123def456...'.
	
	"Join lines with carriage returns"
	content := ''.
	lines do: [:line | 
		content := content, line, String cr].
	
	"Save to Desktop (writable location)"
	[file := FileStream newFileNamed: fullPath.
	 file nextPutAll: content.
	 file close.
	 ^ 'Settings template created: ', fullPath]
		on: Error
		do: [:ex | ^ 'Could not create settings file: ', ex messageText]! !

!CloudAIMorph methodsFor: 'interaction'!
enableDragging
	"Make the morph draggable"
	self on: #mouseDown send: #startDrag: to: self.
	self on: #mouseMove send: #drag: to: self.
	self on: #mouseUp send: #endDrag: to: self! !

!CloudAIMorph methodsFor: 'interaction'!
startDrag: event
	"Start dragging the morph"
	self isDragging: true.
	self dragOffset: event position - self position! !

!CloudAIMorph methodsFor: 'interaction'!
drag: event
	"Drag the morph around"
	self isDragging ifTrue: [
		self position: event position - self dragOffset
	]! !

!CloudAIMorph methodsFor: 'interaction'!
endDrag: event
	"End dragging"
	self isDragging: false! !

!CloudAIMorph methodsFor: 'accessing'!
isDragging
	"Check if currently being dragged"
	^ self valueOfProperty: #isDragging ifAbsent: [false]! !

!CloudAIMorph methodsFor: 'accessing'!
isDragging: aBoolean
	"Set dragging state"
	self setProperty: #isDragging toValue: aBoolean! !

!CloudAIMorph methodsFor: 'accessing'!
dragOffset
	"Get drag offset"
	^ self valueOfProperty: #dragOffset ifAbsent: [0@0]! !

!CloudAIMorph methodsFor: 'accessing'!
dragOffset: aPoint
	"Set drag offset"
	self setProperty: #dragOffset toValue: aPoint! !

!CloudAIMorph class methodsFor: 'instance creation'!
demo
	"Create and show a CloudAIMorph"
	^ self new openInWorld! !

!CloudAIMorph class methodsFor: 'instance creation'!
checkQuery: queryText localAnswer: localAnswer
	"Create CloudAIMorph and check specific query"
	| morph |
	morph := self new.
	morph openInWorld.
	morph setQueryText: queryText.
	morph performCloudCheck.
	^ morph! !

!CloudAIMorph class methodsFor: 'settings'!
createApiKeyFile
	"Create API key settings file template"
	^ self new createSettingsFileTemplate! !