!CloudAIMorph methodsFor: 'network-debug'!
testNetworkConnectivity
	"Test network connectivity with safe OSProcess handling"
	| result |
	
	result := 'NETWORK CONNECTIVITY TEST', String cr,
		'==========================', String cr, String cr.
	
	"Test 1: Basic ping"
	result := result, '1. Testing ping to google.com:', String cr.
	result := result, (self testCommandSafely: 'ping -c 3 google.com').
	result := result, String cr.
	
	"Test 2: Basic HTTP"
	result := result, '2. Testing HTTP to httpbin.org:', String cr.
	result := result, (self testCommandSafely: 'curl -m 5 -s http://httpbin.org/get').
	result := result, String cr.
	
	"Test 3: HTTPS to httpbin"
	result := result, '3. Testing HTTPS to httpbin.org:', String cr.
	result := result, (self testCommandSafely: 'curl -m 5 -s https://httpbin.org/get').
	result := result, String cr.
	
	"Test 4: Basic curl version"
	result := result, '4. Testing curl version:', String cr.
	result := result, (self testCommandSafely: 'curl --version').
	result := result, String cr.
	
	^ result! !

!CloudAIMorph methodsFor: 'network-debug'!
testCommandSafely: commandString
	"Test a command with safe OSProcess handling"
	| osProcess result waitCount |
	
	result := 'Command: ', commandString, String cr.
	
	[
		osProcess := OSProcess command: commandString.
		
		result := result, 'Process created: ', osProcess class name, String cr.
		
		waitCount := 0.
		[osProcess isComplete not and: [waitCount < 25]] whileTrue: [
			(Delay forMilliseconds: 200) wait.
			waitCount := waitCount + 1].
		
		result := result, 'Wait completed after: ', waitCount printString, ' cycles', String cr.
		result := result, 'Process complete: ', osProcess isComplete printString, String cr.
		
		osProcess isComplete ifFalse: [
			[osProcess terminate] on: Error do: [:termEx | ].
			result := result, 'TIMEOUT after 5 seconds', String cr.
			^ result].
		
		"Try to get exit status"
		[
			result := result, 'Exit code: ', osProcess exitStatus printString, String cr.
		] on: Error do: [:statusEx |
			result := result, 'Exit status error: ', statusEx messageText, String cr].
		
		"Try to get output using different approaches"
		[
			| output |
			"Approach 1: Direct stdout access"
			[
				output := osProcess stdout.
				output ifNotNil: [
					result := result, 'Direct stdout (', output size printString, ' bytes): ', 
						(output copyFrom: 1 to: (100 min: output size)), String cr].
			] on: Error do: [:ex1 |
				result := result, 'Direct stdout failed: ', ex1 messageText, String cr.
				
				"Approach 2: Try stdoutStream contents"
				[
					osProcess stdoutStream ifNotNil: [:stream |
						output := stream contents.
						output ifNotNil: [
							result := result, 'Stream contents (', output size printString, ' bytes): ', 
								(output copyFrom: 1 to: (100 min: output size)), String cr]].
				] on: Error do: [:ex2 |
					result := result, 'Stream contents failed: ', ex2 messageText, String cr.
					
					"Approach 3: Try reading stream directly"
					[
						osProcess stdoutStream ifNotNil: [:stream |
							output := stream upToEnd.
							output ifNotNil: [
								result := result, 'Stream upToEnd (', output size printString, ' bytes): ', 
									(output copyFrom: 1 to: (100 min: output size)), String cr]].
					] on: Error do: [:ex3 |
						result := result, 'All output methods failed', String cr]]].
		] on: Error do: [:outputEx |
			result := result, 'Output access error: ', outputEx messageText, String cr].
		
		"Clean up"
		[osProcess terminate] on: Error do: [:cleanEx | ].
		
	] on: Error do: [:ex |
		result := result, 'Command exception: ', ex messageText, String cr.
		[osProcess ifNotNil: [osProcess terminate]] on: Error do: [:termEx | ]].
	
	^ result! !

!CloudAIMorph methodsFor: 'api-curl-simple'!
curlSimpleTest: queryText
	"Simplified curl test without complex stream handling"
	| result tempFile jsonBody curlCommand osProcess |
	
	result := 'SIMPLE CURL TEST', String cr, String cr.
	
	[
		"Create simple JSON"
		jsonBody := '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}],"max_tokens":50}'.
		tempFile := '/tmp/squeak_simple_test.json'.
		
		| fileStream |
		fileStream := FileStream fileNamed: tempFile.
		fileStream nextPutAll: jsonBody.
		fileStream close.
		
		result := result, 'Created test file: ', tempFile, String cr.
		
		"Simple curl command to test connectivity"
		curlCommand := 'curl -m 10 -s -o /tmp/curl_output.txt -w "HTTP_CODE:%{http_code}" https://httpbin.org/post -d @', tempFile, ' -H "Content-Type: application/json"'.
		
		result := result, 'Testing basic HTTPS POST...', String cr.
		Transcript show: 'CloudAI: Running simple curl test...'; cr.
		
		osProcess := OSProcess command: curlCommand.
		
		| waitCount |
		waitCount := 0.
		[osProcess isComplete not and: [waitCount < 50]] whileTrue: [
			waitCount := waitCount + 1.
			waitCount \\ 10 = 0 ifTrue: [
				Transcript show: 'CloudAI: Simple test waiting... (', waitCount printString, ')'; cr].
			(Delay forMilliseconds: 200) wait].
		
		osProcess isComplete ifFalse: [
			result := result, 'Simple test TIMEOUT', String cr.
		] ifTrue: [
			result := result, 'Simple test completed', String cr.
			
			"Try to read the output file"
			[
				| outputFile outputContent |
				outputFile := '/tmp/curl_output.txt'.
				(FileStream isAFileNamed: outputFile) ifTrue: [
					| outputStream |
					outputStream := FileStream readOnlyFileNamed: outputFile.
					outputContent := outputStream contents.
					outputStream close.
					result := result, 'Output file size: ', outputContent size printString, ' bytes', String cr.
					outputContent size > 0 ifTrue: [
						result := result, 'Output preview: ', (outputContent copyFrom: 1 to: (200 min: outputContent size)), String cr].
					"Clean up output file"
					FileDirectory default deleteFileNamed: outputFile].
			] on: Error do: [:fileEx |
				result := result, 'Output file error: ', fileEx messageText, String cr]].
		
		"Clean up"
		[FileDirectory default deleteFileNamed: tempFile] on: Error do: [:ex | ].
		[osProcess terminate] on: Error do: [:ex | ].
		
	] on: Error do: [:ex |
		result := result, 'Simple test error: ', ex messageText, String cr.
		[FileDirectory default deleteFileNamed: tempFile] on: Error do: [:cleanEx | ]].
	
	^ result! !

!CloudAIMorph methodsFor: 'api-curl-simple'!
performCloudCheck
	"Cloud AI check with simplified approach"
	| queryText result |
	
	queryText := queryMorph text asString.
	queryText isEmpty ifTrue: [
		^ self showMessage: 'Enter a query first'].
	
	self showMessage: 'Testing OSProcess and curl...'.
	checkButton color: Color orange.
	
	[
		"First test OSProcess basics"
		result := self testNetworkConnectivity.
		
		"Then try simplified curl"
		result := result, String cr, String cr.
		result := result, (self curlSimpleTest: queryText).
		
		self showResults: result.
		checkButton color: (Color r: 0.2 g: 0.4 b: 0.8).
		self showMessage: 'OSProcess test completed'
	] fork! !

!CloudAIMorph class methodsFor: 'testing'!
osProcessTest
	"Test OSProcess basics"
	| morph |
	morph := self new.
	^ morph testNetworkConnectivity! !

!CloudAIMorph class methodsFor: 'testing'!
simpleTest: queryText
	"Simple curl test"
	| morph |
	morph := self new.
	^ morph curlSimpleTest: queryText! !