!CloudAIMorph methodsFor: 'network-debug'!
testNetworkConnectivity
	"Test network connectivity step by step"
	| result |
	
	result := 'NETWORK CONNECTIVITY TEST', String cr,
		'==========================', String cr, String cr.
	
	"Test 1: Basic ping"
	result := result, '1. Testing ping to google.com:', String cr.
	result := result, (self testCommand: 'ping -c 3 google.com').
	result := result, String cr.
	
	"Test 2: Basic HTTP"
	result := result, '2. Testing HTTP to httpbin.org:', String cr.
	result := result, (self testCommand: 'curl -m 5 -s http://httpbin.org/get').
	result := result, String cr.
	
	"Test 3: HTTPS to httpbin"
	result := result, '3. Testing HTTPS to httpbin.org:', String cr.
	result := result, (self testCommand: 'curl -m 5 -s https://httpbin.org/get').
	result := result, String cr.
	
	"Test 4: HTTPS to OpenAI (just connection)"
	result := result, '4. Testing HTTPS connection to OpenAI:', String cr.
	result := result, (self testCommand: 'curl -m 5 -s -I https://api.openai.com').
	result := result, String cr.
	
	^ result! !

!CloudAIMorph methodsFor: 'network-debug'!
testCommand: commandString
	"Test a command with timeout"
	| osProcess output result waitCount |
	
	result := 'Command: ', commandString, String cr.
	
	[
		osProcess := OSProcess command: commandString.
		
		waitCount := 0.
		[osProcess isComplete not and: [waitCount < 25]] whileTrue: [
			(Delay forMilliseconds: 200) wait.
			waitCount := waitCount + 1].
		
		osProcess isComplete ifFalse: [
			osProcess terminate.
			result := result, 'TIMEOUT after 5 seconds', String cr.
			^ result].
		
		output := osProcess stdoutStream contents.
		output ifNil: [output := ''].
		
		result := result, 'Exit code: ', osProcess exitStatus printString, String cr.
		
		output isEmpty ifFalse: [
			result := result, 'Output (first 200 chars): ', 
				(output copyFrom: 1 to: (200 min: output size)), String cr].
		
		"Check stderr"
		osProcess stderrStream ifNotNil: [:errStream |
			| errorOutput |
			errorOutput := errStream contents.
			errorOutput ifNotNil: [
				errorOutput isEmpty ifFalse: [
					result := result, 'Error: ', 
						(errorOutput copyFrom: 1 to: (200 min: errorOutput size)), String cr]]].
		
		osProcess terminate.
		
	] on: Error do: [:ex |
		result := result, 'Exception: ', ex messageText, String cr.
		[osProcess terminate] on: Error do: [:termEx | ]].
	
	^ result! !

!CloudAIMorph methodsFor: 'api-curl-fixed'!
curlOpenAIWithTimeout: queryText
	"Query OpenAI using curl with aggressive timeout"
	| apiKey jsonBody tempFile curlCommand osProcess output result fileStream |
	
	result := ''.
	
	"Check API key"
	apiKey := self getOpenAIApiKey.
	apiKey = 'YOUR_OPENAI_API_KEY_HERE' ifTrue: [
		^ result, 'ERROR: No OpenAI API key configured', String cr].
	
	[
		"Create JSON request body"
		jsonBody := '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"', 
			(self escapeJsonString: queryText), 
			'"}],"max_tokens":100,"temperature":0.7}'.
		
		"Create temporary file for JSON"
		tempFile := '/tmp/squeak_openai_', DateAndTime now asSeconds printString, '.json'.
		
		"Write JSON to temp file"
		fileStream := FileStream fileNamed: tempFile.
		fileStream nextPutAll: jsonBody.
		fileStream close.
		
		result := result, 'Created request file: ', tempFile, String cr.
		
		"Build curl command with aggressive timeouts"
		curlCommand := 'curl --max-time 10 --connect-timeout 5 -s -X POST https://api.openai.com/v1/chat/completions ',
			'-H "Content-Type: application/json" ',
			'-H "Authorization: Bearer ', apiKey, '" ',
			'-d @', tempFile.
		
		result := result, 'Executing with 10s timeout...', String cr.
		Transcript show: 'CloudAI: Executing curl with timeout...'; cr.
		
		"Execute curl via OSProcess"
		osProcess := OSProcess command: curlCommand.
		
		"Wait with our own timeout"
		| waitCount |
		waitCount := 0.
		[osProcess isComplete not and: [waitCount < 60]] whileTrue: [
			waitCount := waitCount + 1.
			waitCount \\ 10 = 0 ifTrue: [
				Transcript show: 'CloudAI: Still waiting... (', (waitCount * 200 // 1000) printString, 's)'; cr].
			(Delay forMilliseconds: 200) wait].
		
		osProcess isComplete ifFalse: [
			Transcript show: 'CloudAI: Forcing termination due to timeout'; cr.
			osProcess terminate.
			result := result, 'TIMEOUT: curl command took longer than 12 seconds', String cr.
			result := result, 'This suggests network connectivity issues.', String cr.
			^ result].
		
		"Get output"
		output := osProcess stdoutStream contents.
		output ifNil: [output := ''].
		
		result := result, 'curl completed - Exit code: ', osProcess exitStatus printString, String cr.
		result := result, 'Response size: ', output size printString, ' bytes', String cr.
		
		"Check for curl errors in stderr"
		osProcess stderrStream ifNotNil: [:errStream |
			| errorOutput |
			errorOutput := errStream contents.
			errorOutput ifNotNil: [
				errorOutput isEmpty ifFalse: [
					result := result, 'curl errors: ', errorOutput, String cr]]].
		
		"Process response"
		output isEmpty ifTrue: [
			result := result, 'No response received from OpenAI API', String cr.
		] ifFalse: [
			"Try to parse response"
			| extractedContent |
			extractedContent := self parseOpenAIResponse: output.
			result := result, String cr, 'API Response:', String cr,
				extractedContent, String cr].
		
		"Clean up"
		[FileDirectory default deleteFileNamed: tempFile] on: Error do: [:ex | ].
		osProcess terminate.
		
	] on: Error do: [:ex |
		result := result, 'Error: ', ex messageText, String cr.
		[FileDirectory default deleteFileNamed: tempFile] on: Error do: [:cleanEx | ].
		[osProcess terminate] on: Error do: [:termEx | ]].
	
	^ result! !

!CloudAIMorph methodsFor: 'api-curl-fixed'!
performCloudCheck
	"Cloud AI check with network debugging"
	| queryText result |
	
	queryText := queryMorph text asString.
	queryText isEmpty ifTrue: [
		^ self showMessage: 'Enter a query first'].
	
	self showMessage: 'Running network diagnostics...'.
	checkButton color: Color orange.
	
	[
		"First run network connectivity test"
		result := self testNetworkConnectivity.
		
		"Then try OpenAI API if network seems ok"
		result := result, String cr, String cr, 'OPENAI API TEST:', String cr,
			'================', String cr.
		result := result, (self curlOpenAIWithTimeout: queryText).
		
		self showResults: result.
		checkButton color: (Color r: 0.2 g: 0.4 b: 0.8).
		self showMessage: 'Network test completed'
	] fork! !

!CloudAIMorph class methodsFor: 'testing'!
networkTest
	"Test network connectivity"
	| morph |
	morph := self new.
	^ morph testNetworkConnectivity! !