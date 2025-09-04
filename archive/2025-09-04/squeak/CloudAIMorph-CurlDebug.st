!CloudAIMorph methodsFor: 'api-curl'!
curlOpenAI: queryText
	"Query OpenAI using curl with enhanced debugging"
	| apiKey jsonBody tempFile curlCommand osProcess output result fileStream waitCount extractedContent |
	
	result := ''.
	
	"Check API key"
	apiKey := self getOpenAIApiKey.
	apiKey = 'YOUR_OPENAI_API_KEY_HERE' ifTrue: [
		^ result, 'ERROR: No OpenAI API key configured', String cr,
			'Set OPENAI_API_KEY in .env file or environment', String cr, String cr,
			'Using mock response:', String cr,
			(self generateMockResponse: queryText)].
	
	[
		"Create JSON request body"
		jsonBody := '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"', 
			(self escapeJsonString: queryText), 
			'"}],"max_tokens":150,"temperature":0.7}'.
		
		result := result, 'JSON body created: ', jsonBody, String cr, String cr.
		
		"Create temporary file for JSON"
		tempFile := '/tmp/squeak_openai_', DateAndTime now asSeconds printString, '.json'.
		
		"Write JSON to temp file"
		fileStream := FileStream fileNamed: tempFile.
		fileStream nextPutAll: jsonBody.
		fileStream close.
		
		result := result, 'JSON file created: ', tempFile, String cr.
		result := result, 'File size: ', jsonBody size printString, ' bytes', String cr, String cr.
		
		"Build curl command - simplified for debugging"
		curlCommand := 'curl -v -X POST https://api.openai.com/v1/chat/completions ',
			'-H "Content-Type: application/json" ',
			'-H "Authorization: Bearer ', apiKey, '" ',
			'-d @', tempFile.
		
		result := result, 'Curl command: ', curlCommand, String cr, String cr.
		Transcript show: 'CloudAI: Executing: ', curlCommand; cr.
		
		"Execute curl via OSProcess"
		osProcess := OSProcess command: curlCommand.
		
		result := result, 'OSProcess created: ', osProcess printString, String cr.
		Transcript show: 'CloudAI: OSProcess created'; cr.
		
		"Wait for completion with shorter timeout and more feedback"
		waitCount := 0.
		[osProcess isComplete not and: [waitCount < 30]] whileTrue: [
			waitCount := waitCount + 1.
			waitCount \\ 5 = 0 ifTrue: [
				Transcript show: 'CloudAI: Waiting... (', waitCount printString, '/30)'; cr].
			(Delay forMilliseconds: 200) wait].
		
		result := result, 'Wait completed. Count: ', waitCount printString, String cr.
		result := result, 'Process complete: ', osProcess isComplete printString, String cr.
		
		osProcess isComplete ifFalse: [
			Transcript show: 'CloudAI: Process timeout - terminating'; cr.
			osProcess terminate.
			^ result, 'ERROR: curl command timed out after 6 seconds', String cr].
		
		"Get output and error streams"
		output := ''.
		[
			osProcess stdoutStream ifNotNil: [:stream |
				output := stream contents.
				output ifNil: [output := '']].
		] on: Error do: [:ex |
			result := result, 'Stdout error: ', ex messageText, String cr].
		
		result := result, 'Exit status: ', osProcess exitStatus printString, String cr.
		result := result, 'Response length: ', output size printString, ' bytes', String cr.
		
		"Check stderr for curl errors"
		[
			osProcess stderrStream ifNotNil: [:errStream |
				| errorOutput |
				errorOutput := errStream contents.
				errorOutput ifNotNil: [
					errorOutput isEmpty ifFalse: [
						result := result, 'STDERR: ', errorOutput, String cr]]].
		] on: Error do: [:ex |
			result := result, 'Stderr error: ', ex messageText, String cr].
		
		result := result, String cr.
		
		"Display response"
		output isEmpty ifTrue: [
			result := result, 'ERROR: No response from curl', String cr.
		] ifFalse: [
			result := result, 'RAW API RESPONSE:', String cr,
				'-' copyReplicated: 20, String cr,
				output, String cr,
				'-' copyReplicated: 20, String cr, String cr.
			
			"Try to extract content"
			extractedContent := self parseOpenAIResponse: output.
			result := result, 'EXTRACTED CONTENT:', String cr,
				'=' copyReplicated: 20, String cr,
				extractedContent, String cr,
				'=' copyReplicated: 20, String cr].
		
		"Clean up temp file"
		[FileDirectory default deleteFileNamed: tempFile] on: Error do: [:ex |
			result := result, 'Cleanup error: ', ex messageText, String cr].
		
		"Terminate process"
		[osProcess terminate] on: Error do: [:ex |
			result := result, 'Terminate error: ', ex messageText, String cr].
		
	] on: Error do: [:ex |
		result := result, 'curl execution error: ', ex messageText, String cr.
		Transcript show: 'CloudAI: Exception: ', ex messageText; cr.
		"Try to clean up"
		[FileDirectory default deleteFileNamed: tempFile] on: Error do: [:cleanEx | ].
		[osProcess ifNotNil: [osProcess terminate]] on: Error do: [:termEx | ]].
	
	^ result! !

!CloudAIMorph methodsFor: 'api-curl'!
testCurlBasic
	"Test basic curl connectivity"
	| curlCommand osProcess output result waitCount |
	
	result := 'BASIC CURL TEST', String cr, String cr.
	
	"Test simple curl to httpbin"
	curlCommand := 'curl -s http://httpbin.org/get'.
	
	result := result, 'Testing: ', curlCommand, String cr.
	Transcript show: 'CloudAI: Testing basic curl...'; cr.
	
	[
		osProcess := OSProcess command: curlCommand.
		
		waitCount := 0.
		[osProcess isComplete not and: [waitCount < 20]] whileTrue: [
			(Delay forMilliseconds: 200) wait.
			waitCount := waitCount + 1].
		
		osProcess isComplete ifFalse: [
			osProcess terminate.
			^ result, 'Basic curl test FAILED - timeout', String cr].
		
		output := osProcess stdoutStream contents.
		output ifNil: [output := ''].
		
		result := result, 'Exit code: ', osProcess exitStatus printString, String cr.
		result := result, 'Response length: ', output size printString, ' bytes', String cr.
		
		output isEmpty ifFalse: [
			result := result, 'Response preview: ', (output copyFrom: 1 to: (100 min: output size)), String cr].
		
		osProcess terminate.
		
	] on: Error do: [:ex |
		result := result, 'Basic curl error: ', ex messageText, String cr.
		[osProcess terminate] on: Error do: [:termEx | ]].
	
	^ result! !

!CloudAIMorph methodsFor: 'api-curl'!
performCloudCheck
	"Cloud AI check using curl for HTTPS"
	| queryText result |
	
	queryText := queryMorph text asString.
	queryText isEmpty ifTrue: [
		^ self showMessage: 'Enter a query first'].
	
	self showMessage: 'Testing curl connectivity...'.
	checkButton color: Color orange.
	
	[
		"First test basic curl"
		result := self testCurlBasic.
		result := result, String cr, String cr.
		
		"Then try OpenAI if basic works"
		(result includesSubstring: 'Basic curl test FAILED') ifFalse: [
			result := result, (self curlOpenAI: queryText)].
		
		self showResults: result.
		checkButton color: (Color r: 0.2 g: 0.4 b: 0.8).
		self showMessage: 'Curl test completed'
	] fork! !

!CloudAIMorph class methodsFor: 'testing'!
curlBasicTest
	"Test basic curl connectivity"
	| morph |
	morph := self new.
	^ morph testCurlBasic! !