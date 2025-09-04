!CloudAIMorph methodsFor: 'api-curl'!
performCloudCheck
	"Cloud AI check using curl for HTTPS"
	| queryText result |
	
	queryText := queryMorph text asString.
	queryText isEmpty ifTrue: [
		^ self showMessage: 'Enter a query first'].
	
	self showMessage: 'Querying cloud AI via curl...'.
	checkButton color: Color orange.
	
	[
		result := self queryCloudAIViaCurl: queryText.
		self showResults: result.
		checkButton color: (Color r: 0.2 g: 0.4 b: 0.8).
		self showMessage: 'Cloud AI query completed'
	] fork! !

!CloudAIMorph methodsFor: 'api-curl'!
queryCloudAIViaCurl: queryText
	"Query cloud AI using system curl"
	| result |
	
	result := 'CLOUD AI VIA CURL', String cr,
		'==================', String cr, String cr.
	
	"Check if OSProcess is available"
	(Smalltalk hasClassNamed: #OSProcess) ifFalse: [
		^ result, 'ERROR: OSProcess not available', String cr,
			'Install OSProcess for curl support', String cr,
			'Using mock response instead:', String cr, String cr,
			(self generateMockResponse: queryText)].
	
	"Try curl approach with OpenAI first"
	result := result, 'Attempting OpenAI API via curl...', String cr.
	result := result, (self curlOpenAI: queryText).
	
	^ result! !

!CloudAIMorph methodsFor: 'api-curl'!
curlOpenAI: queryText
	"Query OpenAI using curl"
	| apiKey jsonBody tempFile curlCommand osProcess output result |
	
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
		
		"Create temporary file for JSON"
		tempFile := '/tmp/squeak_openai_', DateAndTime now asSeconds printString, '.json'.
		
		"Write JSON to temp file"
		| fileStream |
		fileStream := FileStream fileNamed: tempFile.
		fileStream nextPutAll: jsonBody.
		fileStream close.
		
		result := result, 'JSON request file created (', jsonBody size printString, ' bytes)', String cr.
		
		"Build curl command"
		curlCommand := 'curl -s -X POST https://api.openai.com/v1/chat/completions ',
			'-H "Content-Type: application/json" ',
			'-H "Authorization: Bearer ', apiKey, '" ',
			'-d @', tempFile, ' 2>&1'.
		
		Transcript show: 'CloudAI: Executing curl command...'; cr.
		
		"Execute curl via OSProcess"
		osProcess := OSProcess command: curlCommand.
		
		"Wait for completion with timeout"
		| waitCount |
		waitCount := 0.
		[osProcess isComplete not and: [waitCount < 100]] whileTrue: [
			(Delay forMilliseconds: 100) wait.
			waitCount := waitCount + 1].
		
		osProcess isComplete ifFalse: [
			osProcess terminate.
			^ result, 'ERROR: curl command timed out after 10 seconds', String cr].
		
		"Get output"
		output := osProcess stdoutStream contents.
		output ifNil: [output := ''].
		
		result := result, 'curl completed (exit code: ', osProcess exitStatus printString, ')', String cr.
		result := result, 'Response length: ', output size printString, ' bytes', String cr, String cr.
		
		"Parse and display response"
		output isEmpty ifTrue: [
			result := result, 'ERROR: No response from OpenAI API', String cr.
		] ifFalse: [
			result := result, 'RAW API RESPONSE:', String cr,
				'-' copyReplicated: 20, String cr,
				output, String cr,
				'-' copyReplicated: 20, String cr, String cr.
			
			"Try to extract content"
			| extractedContent |
			extractedContent := self parseOpenAIResponse: output.
			result := result, 'EXTRACTED CONTENT:', String cr,
				'=' copyReplicated: 20, String cr,
				extractedContent, String cr,
				'=' copyReplicated: 20, String cr].
		
		"Clean up temp file"
		[FileDirectory default deleteFileNamed: tempFile] on: Error do: [:ex | ].
		
		"Terminate process"
		osProcess terminate.
		
	] on: Error do: [:ex |
		result := result, 'curl execution error: ', ex messageText, String cr.
		"Try to clean up"
		[FileDirectory default deleteFileNamed: tempFile] on: Error do: [:cleanEx | ].
		[osProcess terminate] on: Error do: [:termEx | ]].
	
	^ result! !

!CloudAIMorph methodsFor: 'api-curl'!
escapeJsonString: text
	"Escape string for JSON (safe version)"
	| escaped |
	escaped := text copyReplaceAll: '\' with: '\\'.
	escaped := escaped copyReplaceAll: '"' with: '\"'.
	escaped := escaped copyReplaceAll: String cr with: '\n'.
	escaped := escaped copyReplaceAll: String tab with: '\t'.
	^ escaped! !

!CloudAIMorph methodsFor: 'api-curl'!
parseOpenAIResponse: jsonResponse
	"Parse OpenAI JSON response to extract content"
	| contentStart contentEnd content |
	
	[
		"Check for error first"
		(jsonResponse includesSubstring: '"error"') ifTrue: [
			| errorStart errorEnd errorMsg |
			errorStart := jsonResponse findString: '"message":"'.
			errorStart > 0 ifTrue: [
				errorStart := errorStart + 11.
				errorEnd := jsonResponse findString: '"' startingAt: errorStart.
				errorEnd > 0 ifTrue: [
					errorMsg := jsonResponse copyFrom: errorStart to: errorEnd - 1.
					^ 'OpenAI API Error: ', errorMsg]].
			^ 'OpenAI API Error: ', jsonResponse].
		
		"Look for content field"
		contentStart := jsonResponse findString: '"content":"'.
		contentStart = 0 ifTrue: [
			^ 'No content field found in response: ', (jsonResponse copyFrom: 1 to: (200 min: jsonResponse size))].
		
		contentStart := contentStart + 11.
		contentEnd := jsonResponse findString: '"' startingAt: contentStart.
		contentEnd = 0 ifTrue: [
			^ 'Could not find end of content field'].
		
		content := jsonResponse copyFrom: contentStart to: contentEnd - 1.
		
		"Clean up escaped characters"
		content := content copyReplaceAll: '\n' with: String cr.
		content := content copyReplaceAll: '\t' with: String tab.
		content := content copyReplaceAll: '\"' with: '"'.
		content := content copyReplaceAll: '\\' with: '\'.
		
		^ content isEmpty 
			ifTrue: ['Empty response from OpenAI'] 
			ifFalse: [content]
		
	] on: Error do: [:ex |
		^ 'Error parsing OpenAI response: ', ex messageText]! !

!CloudAIMorph methodsFor: 'api-curl'!
generateMockResponse: queryText
	"Enhanced mock response for development"
	| mockContent |
	
	mockContent := nil.
	
	(queryText asLowercase includesSubstring: 'apple') ifTrue: [
		mockContent := 'Apple Inc. was founded by Steve Jobs, Steve Wozniak, and Ronald Wayne on April 1, 1976, in Los Altos, California. The company started in Jobs'' parents'' garage and grew to become one of the world''s most valuable technology companies, revolutionizing personal computing with the Apple II, transforming mobile phones with the iPhone, and creating new product categories with the iPad and Apple Watch.'].
	
	(queryText asLowercase includesSubstring: 'tesla') ifTrue: [
		mockContent := 'Tesla, Inc. was founded in July 2003 by Martin Eberhard and Marc Tarpenning. Elon Musk joined the company in February 2004 as chairman of the board and later became CEO in 2008. Tesla has become the world''s most valuable automaker by pioneering mass-market electric vehicles and sustainable energy solutions, including solar panels and energy storage systems.'].
	
	(queryText asLowercase includesSubstring: 'weather') ifTrue: [
		mockContent := 'I cannot provide current weather information as I don''t have access to real-time data. For accurate weather forecasts, please check a weather service like Weather.com, AccuWeather, or your local meteorological service. Weather conditions change frequently and require up-to-date data sources.'].
	
	(queryText asLowercase includesSubstring: 'time') ifTrue: [
		mockContent := 'The current time depends on your location and time zone. For accurate current time, check your system clock or use an online world clock service. Different regions observe different time zones and daylight saving time rules.'].
	
	mockContent isNil ifTrue: [
		mockContent := 'This is a comprehensive mock AI response addressing your query: "', queryText, '". In a production environment with proper API access, this would be an actual response from OpenAI''s GPT model, providing detailed, contextual, and accurate information based on its training data. The mock system demonstrates the interface and workflow while SSL/API connectivity is being resolved.'].
	
	^ 'DEVELOPMENT MOCK RESPONSE', String cr, 
		'(Simulated AI - Enable API for real responses)', String cr, String cr, 
		mockContent, String cr, String cr,
		'STATUS: SSL Error -5 prevents direct HTTPS connection.', String cr,
		'SOLUTION: Using curl via OSProcess for production HTTPS calls.'! !

!CloudAIMorph class methodsFor: 'testing'!
curlTest: queryText
	"Test curl-based cloud AI with specific query"
	| morph |
	morph := self new.
	^ morph queryCloudAIViaCurl: queryText! !