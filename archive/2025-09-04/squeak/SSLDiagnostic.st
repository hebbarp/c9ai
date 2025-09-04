!Object class methodsFor: 'ssl testing'!
sslDiagnostic
	"Comprehensive SSL diagnostic test"
	| result socket address sslSocket |
	
	result := 'SSL DIAGNOSTIC REPORT', String cr,
		'====================', String cr, String cr.
	
	"Test 1: Basic socket connection"
	result := result, '1. TCP CONNECTION TEST:', String cr.
	[
		socket := Socket new.
		address := NetNameResolver addressForName: 'api.openai.com' timeout: 10.
		socket connectTo: address port: 443.
		socket waitForConnectionFor: 10.
		
		result := result, '   ✓ TCP connection successful', String cr.
		Transcript show: 'SSL Diagnostic: TCP connection OK'; cr.
		
	] on: Error do: [:ex |
		result := result, '   ✗ TCP connection failed: ', ex messageText, String cr.
		^ result].
	
	"Test 2: SSL wrapper creation"
	result := result, String cr, '2. SSL WRAPPER TEST:', String cr.
	[
		sslSocket := SqueakSSL on: socket.
		result := result, '   ✓ SqueakSSL wrapper created', String cr.
		Transcript show: 'SSL Diagnostic: SSL wrapper OK'; cr.
		
	] on: Error do: [:ex |
		result := result, '   ✗ SSL wrapper failed: ', ex messageText, String cr.
		socket close.
		^ result].
	
	"Test 3: SSL configuration"
	result := result, String cr, '3. SSL CONFIGURATION:', String cr.
	[
		"Try different certificate modes"
		sslSocket certificateVerificationMode: 0.
		result := result, '   ✓ Certificate verification disabled', String cr.
		
		"Check SSL state before connect"
		result := result, '   Initial SSL state: ', sslSocket sslState printString, String cr.
		
	] on: Error do: [:ex |
		result := result, '   ✗ SSL configuration failed: ', ex messageText, String cr].
	
	"Test 4: SSL handshake"
	result := result, String cr, '4. SSL HANDSHAKE TEST:', String cr.
	[
		sslSocket connect.
		result := result, '   ✓ SSL handshake successful!', String cr.
		result := result, '   Final SSL state: ', sslSocket sslState printString, String cr.
		Transcript show: 'SSL Diagnostic: SSL handshake SUCCESS!'; cr.
		
		"Test 5: Simple data exchange"
		result := result, String cr, '5. DATA EXCHANGE TEST:', String cr.
		[
			sslSocket sendData: 'GET / HTTP/1.1', String cr, 'Host: api.openai.com', String cr, 'Connection: close', String cr, String cr.
			result := result, '   ✓ HTTPS request sent', String cr.
			
			"Try to receive response"
			| response |
			response := ''.
			3 timesRepeat: [
				| data |
				[
					data := sslSocket receiveData.
					data ifNotNil: [response := response, data].
				] on: Error do: [:readEx | ].
				(Delay forMilliseconds: 200) wait].
			
			response size > 0 
				ifTrue: [result := result, '   ✓ Received ', response size printString, ' bytes', String cr]
				ifFalse: [result := result, '   ! No response data received', String cr].
				
		] on: Error do: [:dataEx |
			result := result, '   ✗ Data exchange failed: ', dataEx messageText, String cr].
		
	] on: Error do: [:handshakeEx |
		result := result, '   ✗ SSL handshake failed: ', handshakeEx messageText, String cr.
		result := result, '   SSL Error Code: -5 usually means:', String cr.
		result := result, '     • Protocol version mismatch', String cr.
		result := result, '     • Cipher suite incompatibility', String cr.
		result := result, '     • Server requires SNI (Server Name Indication)', String cr.
		result := result, '     • Certificate verification issues', String cr.
		result := result, String cr, '   SOLUTIONS:', String cr.
		result := result, '     1. Use HTTP proxy for HTTPS requests', String cr.
		result := result, '     2. Use OSProcess to call curl/wget', String cr.
		result := result, '     3. Use WebClient if available', String cr.
		result := result, '     4. Mock API responses for development', String cr].
	
	"Cleanup"
	[sslSocket destroy] on: Error do: [:ex | ].
	socket close.
	
	result := result, String cr, '6. RECOMMENDATIONS:', String cr.
	result := result, '   For OpenAI API integration:', String cr.
	result := result, '   • Modern APIs require TLS 1.2+ with SNI', String cr.
	result := result, '   • Squeak SSL may be too basic for OpenAI', String cr.
	result := result, '   • Consider using system curl via OSProcess', String cr.
	result := result, '   • Or use HTTP proxy server approach', String cr.
	
	Transcript show: 'SSL Diagnostic: Complete'; cr.
	^ result! !