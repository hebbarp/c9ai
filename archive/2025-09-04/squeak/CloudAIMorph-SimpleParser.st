!CloudAIMorph methodsFor: 'api-working'!
parseOpenAIResponse: jsonResponse
	"Simple robust parser for OpenAI JSON response"
	| contentStart contentEnd content |
	
	[
		"Look for the exact pattern from the response"
		contentStart := jsonResponse findString: '"content": "'.
		contentStart = 0 ifTrue: [
			"Try alternative format without spaces"
			contentStart := jsonResponse findString: '"content":"'.
			contentStart = 0 ifTrue: [
				^ 'Could not find content field in OpenAI response']].
		
		"Move past the content field and opening quote"
		contentStart := contentStart + (contentStart > 0 
			ifTrue: ['"content": "' size]
			ifFalse: ['"content":"' size]).
		
		"Find the end quote - look for quote followed by comma or other JSON syntax"
		contentEnd := contentStart.
		[
			contentEnd := jsonResponse findString: '"' startingAt: contentEnd.
			contentEnd = 0 ifTrue: [
				^ 'Could not find end of content field'].
			
			"Check if this is the real end (followed by comma, brace, etc.)"
			(contentEnd < jsonResponse size and: [
				| nextChar |
				nextChar := jsonResponse at: contentEnd + 1.
				nextChar = $, or: [nextChar = $} or: [nextChar isSeparator]]]) 
				ifTrue: [contentEnd := contentEnd - 1. "This is the end"]
				ifFalse: [contentEnd := contentEnd + 1. "Keep looking"]
		] whileTrue.
		
		content := jsonResponse copyFrom: contentStart to: contentEnd.
		
		"Basic cleanup of common escape sequences"
		content := content copyReplaceAll: '\n' with: String cr.
		content := content copyReplaceAll: '\t' with: String tab.
		content := content copyReplaceAll: '\"' with: '"'.
		
		^ content isEmpty 
			ifTrue: ['Empty content extracted from OpenAI response'] 
			ifFalse: [content]
		
	] on: Error do: [:ex |
		"Fallback - try to extract content manually"
		| lines |
		lines := jsonResponse findTokens: String cr.
		lines do: [:line |
			(line includesSubstring: '"content":') ifTrue: [
				| start end |
				start := line findString: '"content": "'.
				start > 0 ifTrue: [
					start := start + '"content": "' size.
					end := line findString: '"' startingAt: start.
					end > 0 ifTrue: [
						content := line copyFrom: start to: end - 1.
						^ content isEmpty ifFalse: [content] ifTrue: ['Empty content line']]]]].
		^ 'Fallback parsing failed: ', ex messageText]! !

!CloudAIMorph methodsFor: 'api-working'!
curlOpenAIWorking: queryText
	"Working OpenAI integration using file-based curl"
	| apiKey jsonBody tempFile outputFile curlCommand osProcess fileStream waitCount outputStream outputContent result extractedContent |
	
	result := 'OPENAI API VIA CURL (File-based)', String cr,
		'=================================', String cr, String cr.
	
	"Check API key"
	apiKey := self getOpenAIApiKey.
	apiKey = 'YOUR_OPENAI_API_KEY_HERE' ifTrue: [
		^ result, 'ERROR: No OpenAI API key configured', String cr,
			'Configure OPENAI_API_KEY in .env file', String cr].
	
	[
		"Create JSON request body"
		jsonBody := '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"', 
			(self escapeJsonString: queryText), 
			'"}],"max_tokens":150,"temperature":0.7}'.
		
		"Create temporary files"
		tempFile := '/tmp/squeak_openai_request.json'.
		outputFile := '/tmp/squeak_openai_response.json'.
		
		"Write JSON request to file"
		fileStream := FileStream fileNamed: tempFile.
		fileStream nextPutAll: jsonBody.
		fileStream close.
		
		result := result, 'Request file created: ', tempFile, String cr.
		result := result, 'Request size: ', jsonBody size printString, ' bytes', String cr, String cr.
		
		"Build curl command with file output"
		curlCommand := 'curl --max-time 15 --connect-timeout 5 -s -X POST https://api.openai.com/v1/chat/completions ',
			'-H "Content-Type: application/json" ',
			'-H "Authorization: Bearer ', apiKey, '" ',
			'-d @', tempFile, ' ',
			'-o ', outputFile, ' ',
			'-w "HTTP_STATUS:%{http_code}"'.
		
		result := result, 'Executing OpenAI API call...', String cr.
		Transcript show: 'CloudAI: Calling OpenAI API via curl...'; cr.
		
		"Execute curl"
		osProcess := OSProcess command: curlCommand.
		
		"Wait for completion"
		waitCount := 0.
		[osProcess isComplete not and: [waitCount < 75]] whileTrue: [
			waitCount := waitCount + 1.
			waitCount \\ 15 = 0 ifTrue: [
				Transcript show: 'CloudAI: API call in progress... (', (waitCount * 200 // 1000) printString, 's)'; cr].
			(Delay forMilliseconds: 200) wait].
		
		osProcess isComplete ifFalse: [
			[osProcess terminate] on: Error do: [:ex | ].
			result := result, 'TIMEOUT: OpenAI API call took longer than 15 seconds', String cr.
			^ result].
		
		result := result, 'API call completed', String cr.
		result := result, 'curl exit code: ', osProcess exitStatus printString, String cr, String cr.
		
		"Read the response file"
		(FileStream isAFileNamed: outputFile) ifTrue: [
			outputStream := FileStream readOnlyFileNamed: outputFile.
			outputContent := outputStream contents.
			outputStream close.
			
			result := result, 'Response file size: ', outputContent size printString, ' bytes', String cr, String cr.
			
			outputContent isEmpty ifFalse: [
				result := result, 'RAW API RESPONSE:', String cr,
					'------------------', String cr,
					outputContent, String cr,
					'------------------', String cr, String cr.
				
				"Parse the OpenAI response"
				extractedContent := self parseOpenAIResponse: outputContent.
				result := result, 'EXTRACTED AI RESPONSE:', String cr,
					'========================', String cr,
					extractedContent, String cr,
					'========================', String cr]
			ifTrue: [
				result := result, 'Empty response file - possible API error', String cr].
		] ifFalse: [
			result := result, 'Response file not created - curl may have failed', String cr].
		
		"Clean up files"
		[FileDirectory default deleteFileNamed: tempFile] on: Error do: [:ex | ].
		[FileDirectory default deleteFileNamed: outputFile] on: Error do: [:ex | ].
		[osProcess terminate] on: Error do: [:ex | ].
		
	] on: Error do: [:ex |
		result := result, 'OpenAI API error: ', ex messageText, String cr.
		"Clean up on error"
		[FileDirectory default deleteFileNamed: tempFile] on: Error do: [:cleanEx | ].
		[FileDirectory default deleteFileNamed: outputFile] on: Error do: [:cleanEx | ].
		[osProcess ifNotNil: [osProcess terminate]] on: Error do: [:termEx | ]].
	
	^ result! !

!CloudAIMorph methodsFor: 'api-working'!
escapeJsonString: text
	"Escape string for JSON safely"
	| escaped |
	escaped := text copyReplaceAll: '\' with: '\\'.
	escaped := escaped copyReplaceAll: '"' with: '\"'.
	escaped := escaped copyReplaceAll: String cr with: '\n'.
	escaped := escaped copyReplaceAll: String tab with: '\t'.
	^ escaped! !

!CloudAIMorph methodsFor: 'api-working'!
performCloudCheck
	"Working cloud AI check using file-based curl"
	| queryText result |
	
	queryText := queryMorph text asString.
	queryText isEmpty ifTrue: [
		^ self showMessage: 'Enter a query first'].
	
	self showMessage: 'Calling OpenAI API...'.
	checkButton color: Color orange.
	
	[
		result := self curlOpenAIWorking: queryText.
		self showResults: result.
		checkButton color: (Color r: 0.2 g: 0.4 b: 0.8).
		self showMessage: 'OpenAI API call completed'
	] fork! !

!CloudAIMorph class methodsFor: 'testing'!
workingTest: queryText
	"Test working OpenAI integration"
	| morph |
	morph := self new.
	^ morph curlOpenAIWorking: queryText! !