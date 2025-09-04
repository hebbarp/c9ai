!CloudAIMorph methodsFor: 'cloud-ai - complete'!
checkQueryWithCloudAI: queryText
	"Complete cloud AI integration with SSL diagnostic and fallbacks"
	| result |
	
	Transcript show: 'CloudAI: Starting complete check for: "', queryText, '"'; cr.
	
	"Step 1: SSL Diagnostic"
	result := self performSSLDiagnostic.
	
	"Step 2: Try different approaches based on diagnostic"
	(result includesSubstring: 'SSL Handshake: SUCCESS') ifTrue: [
		Transcript show: 'CloudAI: SSL working, trying real API call...'; cr.
		result := result, String cr, String cr, (self tryRealAPICall: queryText)]
	ifFalse: [
		Transcript show: 'CloudAI: SSL failed, trying alternatives...'; cr.
		result := result, String cr, String cr, (self tryAlternativeApproaches: queryText)].
	
	"Step 3: Format final results"
	^ self formatCompleteResults: queryText sslResults: result! !

!CloudAIMorph methodsFor: 'cloud-ai - complete'!
performSSLDiagnostic
	"Comprehensive SSL diagnostic"
	| socket address sslSocket result |
	
	result := 'SSL CONNECTIVITY DIAGNOSTIC', String cr,
		'============================', String cr, String cr.
	
	[
		"Test 1: Basic TCP connection"
		result := result, '1. TCP Connection Test:', String cr.
		socket := Socket new.
		address := NetNameResolver addressForName: 'api.openai.com' timeout: 10.
		socket connectTo: address port: 443.
		socket waitForConnectionFor: 10.
		result := result, '   ✓ TCP connection successful', String cr.
		
		"Test 2: SSL wrapper creation"
		result := result, String cr, '2. SSL Wrapper Test:', String cr.
		sslSocket := SqueakSSL on: socket.
		result := result, '   ✓ SqueakSSL wrapper created', String cr.
		
		"Test 3: Certificate verification setup"
		result := result, String cr, '3. SSL Configuration:', String cr.
		sslSocket certificateVerificationMode: 0.
		result := result, '   ✓ Certificate verification disabled', String cr.
		result := result, '   Initial SSL state: ', sslSocket sslState printString, String cr.
		
		"Test 4: SSL handshake (the critical test)"
		result := result, String cr, '4. SSL Handshake (Critical Test):', String cr.
		[
			sslSocket connect.
			result := result, '   ✓ SSL Handshake: SUCCESS', String cr.
			result := result, '   Final SSL state: ', sslSocket sslState printString, String cr.
			
			"Test 5: Basic data exchange"
			result := result, String cr, '5. HTTPS Data Exchange:', String cr.
			sslSocket sendData: 'GET / HTTP/1.1', String cr, 'Host: api.openai.com', String cr, 'Connection: close', String cr, String cr.
			
			| response |
			response := ''.
			3 timesRepeat: [
				| data |
				[data := sslSocket receiveData.
				 data ifNotNil: [response := response, data]] on: Error do: [:ex | ].
				(Delay forMilliseconds: 200) wait].
			
			response size > 0 
				ifTrue: [result := result, '   ✓ HTTPS response received (', response size printString, ' bytes)', String cr]
				ifFalse: [result := result, '   ! No response data (but SSL worked)', String cr].
				
		] on: Error do: [:sslEx |
			result := result, '   ✗ SSL Handshake FAILED: ', sslEx messageText, String cr.
			result := result, String cr, '   SSL ERROR ANALYSIS:', String cr.
			result := result, '   Error -5 typically means:', String cr.
			result := result, '     • TLS version incompatibility (OpenAI requires 1.2+)', String cr.
			result := result, '     • Missing Server Name Indication (SNI)', String cr.
			result := result, '     • Cipher suite mismatch', String cr.
			result := result, '     • Modern API security requirements', String cr].
		
		"Cleanup"
		[sslSocket destroy] on: Error do: [:ex | ].
		socket close.
		
	] on: Error do: [:ex |
		result := result, '   ✗ Connection failed: ', ex messageText, String cr.
		socket ifNotNil: [socket close]].
	
	^ result! !

!CloudAIMorph methodsFor: 'cloud-ai - complete'!
tryRealAPICall: queryText
	"Attempt real API call when SSL is working"
	| result |
	
	result := 'REAL API CALL ATTEMPT', String cr,
		'=====================', String cr.
	
	"Try OpenAI API with working SSL"
	result := result, (self attemptOpenAIWithSSL: queryText).
	
	^ result! !

!CloudAIMorph methodsFor: 'cloud-ai - complete'!
attemptOpenAIWithSSL: queryText
	"OpenAI API call with working SSL"
	| socket address sslSocket response body headers result |
	
	result := 'OpenAI API Call (SSL):', String cr.
	
	[
		"Check API key first"
		self getOpenAIApiKey = 'YOUR_OPENAI_API_KEY_HERE' ifTrue: [
			^ result, '   ✗ No valid OpenAI API key configured', String cr,
				'   Add OPENAI_API_KEY to .env file', String cr].
		
		"Create SSL connection"
		socket := Socket new.
		address := NetNameResolver addressForName: 'api.openai.com' timeout: 10.
		socket connectTo: address port: 443.
		socket waitForConnectionFor: 10.
		
		sslSocket := SqueakSSL on: socket.
		sslSocket certificateVerificationMode: 0.
		sslSocket connect.
		
		result := result, '   ✓ SSL connection established', String cr.
		
		"Build API request"
		body := self buildOpenAIRequestBody: queryText.
		headers := 'POST /v1/chat/completions HTTP/1.1', String cr,
			'Host: api.openai.com', String cr,
			'Content-Type: application/json', String cr,
			'Authorization: Bearer ', self getOpenAIApiKey, String cr,
			'Content-Length: ', body size printString, String cr,
			'Connection: close', String cr, String cr.
		
		"Send request"
		sslSocket sendData: headers, body.
		result := result, '   ✓ API request sent', String cr.
		
		"Read response"
		response := ''.
		5 timesRepeat: [
			| data |
			[data := sslSocket receiveData.
			 data ifNotNil: [response := response, data]] on: Error do: [:ex | ].
			(Delay forMilliseconds: 300) wait].
		
		result := result, '   Response length: ', response size printString, ' bytes', String cr.
		
		"Parse response"
		response size > 0 ifTrue: [
			| parsedContent |
			parsedContent := self parseOpenAIResponse: response.
			result := result, '   Parsed content: ', parsedContent, String cr].
		
		"Cleanup"
		[sslSocket destroy] on: Error do: [:ex | ].
		socket close.
		
	] on: Error do: [:ex |
		result := result, '   ✗ API call failed: ', ex messageText, String cr.
		socket ifNotNil: [socket close]].
	
	^ result! !

!CloudAIMorph methodsFor: 'cloud-ai - complete'!
tryAlternativeApproaches: queryText
	"Try alternative approaches when SSL fails"
	| result |
	
	result := 'ALTERNATIVE APPROACHES', String cr,
		'======================', String cr, String cr.
	
	"Approach 1: curl via OSProcess (if available)"
	result := result, '1. System curl approach:', String cr.
	(Smalltalk hasClassNamed: #OSProcess) ifTrue: [
		result := result, (self tryCurlMethod: queryText)]
	ifFalse: [
		result := result, '   OSProcess not available', String cr].
	
	result := result, String cr.
	
	"Approach 2: HTTP proxy approach"
	result := result, '2. HTTP connectivity test:', String cr.
	result := result, (self testHTTPConnectivity).
	
	result := result, String cr.
	
	"Approach 3: Mock responses for development"
	result := result, '3. Development mock response:', String cr.
	result := result, (self generateMockResponse: queryText).
	
	^ result! !

!CloudAIMorph methodsFor: 'cloud-ai - complete'!
tryCurlMethod: queryText
	"Try using system curl for API call"
	| jsonBody tempFile curlCommand result output |
	
	result := ''.
	
	[
		"Create JSON request"
		jsonBody := '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"', 
			(self escapeJsonString: queryText), '"}],"max_tokens":100}'.
		
		"Create temp file"
		tempFile := '/tmp/squeak_api_request.json'.
		| fileStream |
		fileStream := FileStream fileNamed: tempFile.
		fileStream nextPutAll: jsonBody; close.
		
		"Build curl command"
		curlCommand := 'curl -s -X POST https://api.openai.com/v1/chat/completions ',
			'-H "Content-Type: application/json" ',
			'-H "Authorization: Bearer ', self getOpenAIApiKey, '" ',
			'-d @', tempFile.
		
		"Execute curl"
		| osProcess |
		osProcess := OSProcess command: curlCommand.
		[osProcess isComplete] whileFalse: [(Delay forMilliseconds: 100) wait].
		
		output := osProcess stdoutStream contents.
		result := result, '   ✓ curl executed, response: ', output size printString, ' bytes', String cr.
		
		"Clean up"
		FileDirectory default deleteFileNamed: tempFile.
		osProcess terminate.
		
		"Parse response"
		(output includesSubstring: '"content"') ifTrue: [
			result := result, '   ✓ Valid API response received', String cr].
		
	] on: Error do: [:ex |
		result := result, '   ✗ curl method failed: ', ex messageText, String cr].
	
	^ result! !

!CloudAIMorph methodsFor: 'cloud-ai - complete'!
testHTTPConnectivity
	"Test basic HTTP connectivity"
	| socket result response |
	
	result := ''.
	
	[
		socket := Socket new.
		| address |
		address := NetNameResolver addressForName: 'httpbin.org' timeout: 10.
		socket connectTo: address port: 80.
		socket waitForConnectionFor: 10.
		
		socket sendData: 'GET /get HTTP/1.1', String cr,
			'Host: httpbin.org', String cr,
			'Connection: close', String cr, String cr.
		
		response := ''.
		3 timesRepeat: [
			| data |
			[data := socket receiveData.
			 data ifNotNil: [response := response, data]] on: Error do: [:ex | ].
			(Delay forMilliseconds: 200) wait].
		
		socket close.
		
		result := result, '   ✓ HTTP test successful (', response size printString, ' bytes)', String cr.
		(response includesSubstring: '"url"') ifTrue: [
			result := result, '   ✓ JSON response received', String cr].
		
	] on: Error do: [:ex |
		result := result, '   ✗ HTTP test failed: ', ex messageText, String cr.
		socket ifNotNil: [socket close]].
	
	^ result! !

!CloudAIMorph methodsFor: 'cloud-ai - complete'!
generateMockResponse: queryText
	"Generate development mock response"
	| result mockContent |
	
	"Generate contextual mock response"
	(queryText asLowercase includesSubstring: 'apple') ifTrue: [
		mockContent := 'Apple Inc. was founded by Steve Jobs, Steve Wozniak, and Ronald Wayne on April 1, 1976. The company started in Jobs'' parents'' garage in Los Altos, California.'].
	
	(queryText asLowercase includesSubstring: 'tesla') ifTrue: [
		mockContent := 'Tesla, Inc. was founded in 2003 by Martin Eberhard and Marc Tarpenning. Elon Musk joined as chairman in 2004 and later became CEO.'].
	
	mockContent ifNil: [
		mockContent := 'This is a mock AI response for development purposes. In production with proper SSL, this would be a real response from OpenAI or Claude analyzing: "', queryText, '"'].
	
	result := '   Mock AI Response:', String cr,
		'   ', mockContent, String cr,
		'   [This is simulated - enable SSL for real AI]', String cr.
	
	^ result! !

!CloudAIMorph methodsFor: 'cloud-ai - complete'!
formatCompleteResults: queryText sslResults: allResults
	"Format the complete diagnostic and API results"
	| separator |
	separator := String new: 50 withAll: $=.
	
	^ 'CLOUD AI INTEGRATION REPORT', String cr,
		separator, String cr, String cr,
		'QUERY: "', queryText, '"', String cr,
		'TIME: ', DateAndTime now asString, String cr, String cr,
		'DIAGNOSTIC & API RESULTS:', String cr,
		'---------------------------', String cr,
		allResults, String cr, String cr,
		'SUMMARY:', String cr,
		'--------', String cr,
		(self generateExecutiveSummary: allResults), String cr, String cr,
		'NEXT STEPS:', String cr,
		'-----------', String cr,
		self generateNextSteps! !

!CloudAIMorph methodsFor: 'cloud-ai - complete'!
generateExecutiveSummary: results
	"Generate executive summary of SSL and API status"
	| summary |
	
	summary := ''.
	
	(results includesSubstring: 'SSL Handshake: SUCCESS') 
		ifTrue: [summary := summary, '✓ SSL connectivity is working', String cr]
		ifFalse: [summary := summary, '✗ SSL connectivity failed (Error -5)', String cr].
	
	(results includesSubstring: 'Valid API response received') 
		ifTrue: [summary := summary, '✓ API call succeeded', String cr]
		ifFalse: [summary := summary, '? API call not attempted or failed', String cr].
	
	(results includesSubstring: 'curl executed') 
		ifTrue: [summary := summary, '✓ System curl is available as fallback', String cr]
		ifFalse: [summary := summary, '? System curl not available', String cr].
	
	(results includesSubstring: 'HTTP test successful') 
		ifTrue: [summary := summary, '✓ Basic HTTP connectivity works', String cr]
		ifFalse: [summary := summary, '✗ Network connectivity issues detected', String cr].
	
	^ summary! !

!CloudAIMorph methodsFor: 'cloud-ai - complete'!
generateNextSteps
	"Generate recommendations for next steps"
	^ '1. SSL Issues: Modern APIs require TLS 1.2+ with SNI support', String cr,
		'2. Alternative: Use curl via OSProcess for HTTPS API calls', String cr,
		'3. Development: Mock responses work for UI testing', String cr,
		'4. Proxy: Consider HTTP proxy server for HTTPS requests', String cr,
		'5. API Keys: Ensure valid keys in .env file', String cr,
		'6. Network: Verify firewall/proxy settings for HTTPS', String cr, String cr,
		'RECOMMENDATION: Use curl method for production SSL issues'! !