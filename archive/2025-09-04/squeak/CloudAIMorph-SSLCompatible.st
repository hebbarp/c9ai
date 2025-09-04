!CloudAIMorph methodsFor: 'cloud-ai - complete'!
performSSLDiagnostic
	"Comprehensive SSL diagnostic with version compatibility"
	| socket address sslSocket result response data |
	
	result := 'SSL CONNECTIVITY DIAGNOSTIC', String cr,
		'============================', String cr, String cr.
	
	[
		result := result, '1. TCP Connection Test:', String cr.
		socket := Socket new.
		address := NetNameResolver addressForName: 'api.openai.com' timeout: 10.
		socket connectTo: address port: 443.
		socket waitForConnectionFor: 10.
		result := result, '   TCP connection successful', String cr.
		
		result := result, String cr, '2. SSL Wrapper Test:', String cr.
		sslSocket := SqueakSSL on: socket.
		result := result, '   SqueakSSL wrapper created', String cr.
		
		result := result, String cr, '3. SSL Configuration:', String cr.
		[
			"Try different SSL configuration methods"
			sslSocket certificateVerificationMode: 0.
			result := result, '   Certificate verification disabled (mode 0)', String cr.
		] on: Error do: [:certEx |
			result := result, '   certificateVerificationMode not available: ', certEx messageText, String cr.
			"Try alternative SSL configuration"
			[
				sslSocket certificateVerification: false.
				result := result, '   Certificate verification disabled (alternative method)', String cr.
			] on: Error do: [:altEx |
				result := result, '   No certificate config method found: ', altEx messageText, String cr.
				result := result, '   Proceeding with default SSL settings', String cr]].
		
		"Check SSL state if possible"
		[
			result := result, '   Initial SSL state: ', sslSocket sslState printString, String cr.
		] on: Error do: [:stateEx |
			result := result, '   SSL state not available: ', stateEx messageText, String cr].
		
		result := result, String cr, '4. SSL Handshake (Critical Test):', String cr.
		[
			sslSocket connect.
			result := result, '   SSL Handshake: SUCCESS', String cr.
			
			"Check final SSL state if possible"
			[
				result := result, '   Final SSL state: ', sslSocket sslState printString, String cr.
			] on: Error do: [:finalStateEx |
				result := result, '   Final SSL state not available', String cr].
			
			result := result, String cr, '5. HTTPS Data Exchange:', String cr.
			sslSocket sendData: 'GET / HTTP/1.1', String cr, 'Host: api.openai.com', String cr, 'Connection: close', String cr, String cr.
			
			response := ''.
			3 timesRepeat: [
				[data := sslSocket receiveData.
				 data ifNotNil: [response := response, data]] on: Error do: [:ex | ].
				(Delay forMilliseconds: 200) wait].
			
			response size > 0 
				ifTrue: [result := result, '   HTTPS response received (', response size printString, ' bytes)', String cr]
				ifFalse: [result := result, '   No response data (but SSL worked)', String cr].
				
		] on: Error do: [:sslEx |
			result := result, '   SSL Handshake FAILED: ', sslEx messageText, String cr.
			result := result, String cr, '   SSL ERROR ANALYSIS:', String cr.
			result := result, '   This SSL implementation may not support:', String cr.
			result := result, '     - Modern TLS versions (1.2, 1.3)', String cr.
			result := result, '     - Server Name Indication (SNI)', String cr.
			result := result, '     - Modern cipher suites', String cr.
			result := result, '     - Certificate chain validation', String cr.
			result := result, String cr, '   RECOMMENDED ALTERNATIVES:', String cr.
			result := result, '     - Use OSProcess with curl/wget', String cr.
			result := result, '     - Use HTTP proxy for HTTPS', String cr.
			result := result, '     - Mock responses for development', String cr].
		
		"Cleanup"
		[sslSocket destroy] on: Error do: [:cleanEx |
			result := result, '   SSL cleanup: ', cleanEx messageText, String cr].
		socket close.
		
	] on: Error do: [:ex |
		result := result, '   Connection failed: ', ex messageText, String cr.
		socket ifNotNil: [socket close]].
	
	^ result! !

!CloudAIMorph methodsFor: 'cloud-ai - integration'!
performCloudCheck
	"Updated cloud check with SSL diagnostic"
	| queryText result |
	
	queryText := queryMorph text asString.
	queryText isEmpty ifTrue: [
		^ self showMessage: 'Enter a query first'].
	
	self showMessage: 'Running SSL diagnostic...'.
	checkButton color: Color orange.
	
	[
		result := self performSSLDiagnostic.
		
		(result includesSubstring: 'SSL Handshake: SUCCESS') ifTrue: [
			result := result, String cr, String cr, 'GREAT NEWS: SSL is working properly.', String cr.
			result := result, 'You can now implement real API calls.', String cr.
		] ifFalse: [
			result := result, String cr, String cr, 'SSL DIAGNOSTIC COMPLETE - Using mock response:', String cr.
			result := result, '=' copyReplicated: 45, String cr.
			result := result, (self generateMockResponse: queryText)].
		
		self showResults: result.
		checkButton color: (Color r: 0.2 g: 0.4 b: 0.8).
		self showMessage: 'SSL diagnostic completed'
	] fork! !

!CloudAIMorph methodsFor: 'cloud-ai - integration'!
generateMockResponse: queryText
	"Generate contextual mock response when SSL fails"
	| mockContent |
	
	mockContent := nil.
	
	(queryText asLowercase includesSubstring: 'apple') ifTrue: [
		mockContent := 'Apple Inc. was founded by Steve Jobs, Steve Wozniak, and Ronald Wayne on April 1, 1976. The company revolutionized personal computing, mobile phones, and digital media.'].
	
	(queryText asLowercase includesSubstring: 'tesla') ifTrue: [
		mockContent := 'Tesla Inc. was founded in 2003 by Martin Eberhard and Marc Tarpenning. Elon Musk joined as chairman in 2004 and became CEO in 2008, leading the electric vehicle revolution.'].
	
	(queryText asLowercase includesSubstring: 'microsoft') ifTrue: [
		mockContent := 'Microsoft was founded by Bill Gates and Paul Allen on April 4, 1975. It became the world largest software company, known for Windows, Office, and cloud computing.'].
	
	(queryText asLowercase includesSubstring: 'google') ifTrue: [
		mockContent := 'Google was founded by Larry Page and Sergey Brin in 1998 while PhD students at Stanford. It started as a search engine and grew into one of the world largest technology companies.'].
	
	mockContent isNil ifTrue: [
		mockContent := 'This is a comprehensive mock AI response for the query: "', queryText, '". In production with working modern SSL/TLS support, this would be an actual response from OpenAI GPT or Anthropic Claude providing detailed, accurate information.'].
	
	^ 'MOCK AI RESPONSE (SSL Limitation)', String cr, String cr, 
		mockContent, String cr, String cr,
		'TECHNICAL NOTE:', String cr,
		'This response is simulated because the current SqueakSSL version', String cr,
		'lacks methods required for modern HTTPS APIs (like certificateVerificationMode).', String cr,
		'For production use, consider system curl via OSProcess or HTTP proxy approaches.'! !

!CloudAIMorph methodsFor: 'cloud-ai - integration'!
quickSSLTest
	"Quick SSL test with better output formatting"
	| result |
	
	result := self performSSLDiagnostic.
	
	"Add summary analysis"
	result := result, String cr, String cr, 'SUMMARY:', String cr.
	result := result, '--------', String cr.
	
	(result includesSubstring: 'certificateVerificationMode not available') ifTrue: [
		result := result, 'SSL API Limitation: Your SqueakSSL version lacks modern SSL methods.', String cr].
	
	(result includesSubstring: 'SSL Handshake: SUCCESS') ifTrue: [
		result := result, 'SSL Status: WORKING - Ready for API integration.', String cr]
	ifFalse: [
		result := result, 'SSL Status: LIMITED - Use alternative HTTPS approaches.', String cr].
	
	self showResults: result.
	^ result! !

!CloudAIMorph class methodsFor: 'testing'!
sslTest
	"Quick SSL test with enhanced reporting"
	| morph |
	morph := self new.
	^ morph quickSSLTest! !