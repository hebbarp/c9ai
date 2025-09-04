!IntegratedAIMorph methodsFor: 'interface'!
buildButtonRow
	| container localAIButton |
	
	container := Morph new
		color: Color transparent;
		layoutPolicy: TableLayout new;
		listDirection: #leftToRight;
		cellPositioning: #center;
		hResizing: #spaceFill;
		vResizing: #rigid;
		extent: 580@35.
	
	"Local AI button - primary response"
	localAIButton := SimpleButtonMorph new
		label: 'Local AI';
		target: self;
		actionSelector: #performLocalAI;
		color: (Color r: 0.3 g: 0.6 b: 0.9);
		extent: 100@30.
	
	verifyCloudButton := SimpleButtonMorph new
		label: 'Cloud AI Verify';
		target: self;
		actionSelector: #performCloudVerify;
		color: (Color r: 0.2 g: 0.7 b: 0.3);
		extent: 120@30.
	
	verifyWebButton := SimpleButtonMorph new
		label: 'Web Search';
		target: self;
		actionSelector: #performWebSearch;
		color: (Color r: 0.3 g: 0.5 b: 0.8);
		extent: 100@30.
	
	computeButton := SimpleButtonMorph new
		label: 'Compute';
		target: self;
		actionSelector: #performCompute;
		color: (Color r: 0.7 g: 0.4 b: 0.2);
		extent: 80@30.
	
	clearButton := SimpleButtonMorph new
		label: 'Clear All';
		target: self;
		actionSelector: #clearAllMorphs;
		color: (Color r: 0.8 g: 0.2 b: 0.2);
		extent: 80@30.
	
	container addMorphBack: localAIButton.
	container addMorphBack: (self buildSpacer: 6).
	container addMorphBack: verifyCloudButton.
	container addMorphBack: (self buildSpacer: 6).
	container addMorphBack: verifyWebButton.
	container addMorphBack: (self buildSpacer: 6).
	container addMorphBack: computeButton.
	container addMorphBack: (self buildSpacer: 6).
	container addMorphBack: clearButton.
	
	^ container! !

!IntegratedAIMorph methodsFor: 'interface'!
buildResponseDisplay
	| display |
	display := PluggableTextMorph new
		extent: 560@300;
		setText: 'Welcome to the Integrated AI System', String cr, String cr,
			'Enter a query above and use the buttons to:', String cr,
			'- Local AI: Get initial AI response', String cr,
			'- Cloud AI Verify: Cross-check with OpenAI GPT', String cr,
			'- Web Search: Verify facts with web search', String cr,
			'- Compute: Execute computational tasks', String cr,
			'- Clear All: Remove all created morphs', String cr, String cr,
			'Workflow: Local AI first, then verify with Cloud AI and Web Search', String cr, String cr,
			'Try queries like:', String cr,
			'- "who founded Apple"', String cr,
			'- "convert 100 celsius to fahrenheit"', String cr,
			'- "what is the weather today"';
		color: Color white;
		borderWidth: 0;
		readOnly: true;
		wrapFlag: true;
		hResizing: #spaceFill;
		vResizing: #shrinkWrap.
	^ display! !

!IntegratedAIMorph methodsFor: 'initialization'!
initialize
	super initialize.
	childMorphs := OrderedCollection new.
	lastQuery := ''.
	lastResponse := ''.
	self setupAppearance.
	self buildInterface.
	self enableDragging! !

!IntegratedAIMorph methodsFor: 'actions'!
performLocalAI
	| queryText result responseMorph |
	
	queryText := queryInput text asString.
	queryText isEmpty ifTrue: [
		^ self showStatus: 'Enter a query first'].
	
	self showStatus: 'Generating local AI response...'.
	localAIButton color: Color orange.
	
	[
		"Create ResponseMorph for local AI response"
		responseMorph := ResponseMorph new.
		self registerChildMorph: responseMorph.
		
		"Generate local response"
		result := self generateLocalResponse: queryText.
		
		"Display results"
		self displayResult: 'LOCAL AI RESPONSE' content: result.
		localAIButton color: (Color r: 0.3 g: 0.6 b: 0.9).
		self showStatus: 'Local AI response generated - ready for verification'
	] fork! !

!IntegratedAIMorph methodsFor: 'actions'!
generateLocalResponse: queryText
	"Generate a local AI response using built-in knowledge"
	| response |
	
	"Check for computational tasks first"
	(queryText asLowercase includesSubstring: 'celsius') and: [queryText asLowercase includesSubstring: 'fahrenheit'] ifTrue: [
		^ self handleTemperatureConversion: queryText].
	
	(queryText asLowercase includesSubstring: 'convert') ifTrue: [
		^ 'This appears to be a conversion request. Try using the Compute button for mathematical conversions.'].
	
	"Knowledge-based responses"
	(queryText asLowercase includesSubstring: 'apple') ifTrue: [
		response := 'Apple Inc. was founded by Steve Jobs, Steve Wozniak, and Ronald Wayne in 1976. The company began in Jobs parents garage in Los Altos, California and has grown to become one of the world most valuable technology companies.'].
	
	(queryText asLowercase includesSubstring: 'tesla') ifTrue: [
		response := 'Tesla, Inc. was founded by Martin Eberhard and Marc Tarpenning in 2003. Elon Musk joined as chairman and investor in 2004 and later became CEO. Tesla is known for electric vehicles, energy storage, and solar panel manufacturing.'].
	
	(queryText asLowercase includesSubstring: 'microsoft') ifTrue: [
		response := 'Microsoft Corporation was founded by Bill Gates and Paul Allen on April 4, 1975. The company started by developing and selling BASIC interpreters and grew to become one of the largest software companies in the world, known for Windows, Office, and cloud services.'].
	
	(queryText asLowercase includesSubstring: 'google') ifTrue: [
		response := 'Google was founded by Larry Page and Sergey Brin in September 1998 while they were PhD students at Stanford University. The company began as a search engine and has expanded to become one of the world largest technology companies.'].
	
	(queryText asLowercase includesSubstring: 'weather') ifTrue: [
		response := 'I cannot provide current weather information as I do not have access to real-time data. For accurate weather information, please use a weather app or website like Weather.com. You could also try the Web Search button to find current weather conditions.'].
	
	response ifNil: [
		response := 'Local AI Analysis of: "', queryText, '"', String cr, String cr,
			'This query requires information that may benefit from verification. I recommend:', String cr,
			'1. Use Cloud AI Verify for comprehensive AI analysis', String cr,
			'2. Use Web Search for current factual information', String cr,
			'3. Use Compute for mathematical calculations', String cr, String cr,
			'The local AI system works best with queries about well-known companies, historical facts, or computational tasks.'].
	
	^ response! !

!IntegratedAIMorph methodsFor: 'actions'!
handleTemperatureConversion: queryText
	"Handle temperature conversion queries"
	| celsius fahrenheit result tokens number |
	
	"Extract numbers from query"
	tokens := queryText findTokens: ' '.
	number := nil.
	tokens do: [:token |
		[number := token asNumber] on: Error do: [:ex | ]].
	
	number ifNil: [
		^ 'Could not find a number in the temperature conversion request. Please specify a temperature like "convert 25 celsius to fahrenheit".'].
	
	"Determine conversion direction"
	(queryText asLowercase includesSubstring: 'celsius') and: [queryText asLowercase includesSubstring: 'fahrenheit'] ifTrue: [
		"Convert C to F"
		fahrenheit := number * 9 / 5 + 32.
		result := number printString, ' degrees Celsius = ', fahrenheit printString, ' degrees Fahrenheit', String cr,
			'Formula used: F = C * 9/5 + 32', String cr,
			'Calculation: ', number printString, ' * 9/5 + 32 = ', fahrenheit printString].
	
	(queryText asLowercase includesSubstring: 'fahrenheit') and: [queryText asLowercase includesSubstring: 'celsius'] ifTrue: [
		"Convert F to C"  
		celsius := (number - 32) * 5 / 9.
		result := number printString, ' degrees Fahrenheit = ', celsius printString, ' degrees Celsius', String cr,
			'Formula used: C = (F - 32) * 5/9', String cr,
			'Calculation: (', number printString, ' - 32) * 5/9 = ', celsius printString].
	
	result ifNil: [
		result := 'Temperature conversion request detected but could not determine conversion direction. Please specify like "25 celsius to fahrenheit" or "77 fahrenheit to celsius".'].
	
	^ result! !

!IntegratedAIMorph methodsFor: 'initialization'!
setupAppearance
	self color: (Color r: 0.98 g: 0.98 b: 1.0).
	self borderWidth: 3.
	self borderColor: (Color r: 0.2 g: 0.4 b: 0.9).
	self extent: 650@500.
	self layoutPolicy: TableLayout new.
	self listDirection: #topToBottom.
	self cellPositioning: #topLeft.
	self hResizing: #spaceFill.
	self vResizing: #spaceFill.
	self layoutInset: 12! !