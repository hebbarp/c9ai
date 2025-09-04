!CloudAIMorph methodsFor: 'cloud-ai - complete'!
performSSLDiagnostic
	"Comprehensive SSL diagnostic"
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
		sslSocket certificateVerificationMode: 0.
		result := result, '   Certificate verification disabled', String cr.
		result := result, '   Initial SSL state: ', sslSocket sslState printString, String cr.
		
		result := result, String cr, '4. SSL Handshake (Critical Test):', String cr.
		[
			sslSocket connect.
			result := result, '   SSL Handshake: SUCCESS', String cr.
			result := result, '   Final SSL state: ', sslSocket sslState printString, String cr.
			
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
			result := result, '   Error -5 typically means:', String cr.
			result := result, '     TLS version incompatibility', String cr.
			result := result, '     Missing Server Name Indication', String cr.
			result := result, '     Cipher suite mismatch', String cr.
			result := result, '     Modern API security requirements', String cr].
		
		[sslSocket destroy] on: Error do: [:ex | ].
		socket close.
		
	] on: Error do: [:ex |
		result := result, '   Connection failed: ', ex messageText, String cr.
		socket ifNotNil: [socket close]].
	
	^ result! !

!CloudAIMorph methodsFor: 'cloud-ai - integration'!
quickSSLTest
	"Quick SSL test method for debugging"
	| result |
	
	result := self performSSLDiagnostic.
	self showResults: result.
	
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
			result := result, String cr, String cr, 'SSL working! Ready for API calls.', String cr.
		] ifFalse: [
			result := result, String cr, String cr, 'SSL FAILED - Using mock response:', String cr,
				'---------------------------------------', String cr,
				(self generateMockResponse: queryText)].
		
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
		mockContent := 'Apple Inc. was founded by Steve Jobs, Steve Wozniak, and Ronald Wayne on April 1, 1976.'].
	
	(queryText asLowercase includesSubstring: 'tesla') ifTrue: [
		mockContent := 'Tesla Inc. was founded in 2003 by Martin Eberhard and Marc Tarpenning.'].
	
	(queryText asLowercase includesSubstring: 'microsoft') ifTrue: [
		mockContent := 'Microsoft was founded by Bill Gates and Paul Allen on April 4, 1975.'].
	
	(queryText asLowercase includesSubstring: 'google') ifTrue: [
		mockContent := 'Google was founded by Larry Page and Sergey Brin in 1998.'].
	
	mockContent isNil ifTrue: [
		mockContent := 'This is a mock AI response for development testing.'].
	
	^ '[MOCK RESPONSE - SSL Error -5]', String cr, String cr, mockContent, String cr, String cr,
		'NOTE: This is simulated because SSL handshake failed.', String cr,
		'Enable modern TLS support for real AI responses.'! !

!CloudAIMorph class methodsFor: 'testing'!
sslTest
	"Quick SSL test"
	| morph |
	morph := self new.
	^ morph quickSSLTest! !