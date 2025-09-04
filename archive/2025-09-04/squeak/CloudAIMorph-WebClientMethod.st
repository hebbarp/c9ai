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
		^ self parseOpenAIResponse: response
		
	] on: Error do: [:ex |
		Transcript show: 'DEBUG: Outer exception: ', ex messageText; cr.
		^ 'OpenAI WebClient Exception: ', ex messageText]! !