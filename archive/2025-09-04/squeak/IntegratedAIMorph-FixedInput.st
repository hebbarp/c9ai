Morph subclass: #IntegratedAIMorph
	instanceVariableNames: 'titleMorph queryInput responseDisplay localAIButton verifyCloudButton verifyWebButton computeButton clearButton statusMorph scrollPane lastQuery lastResponse childMorphs aiClient'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!IntegratedAIMorph commentStamp: 'C9AI 8/24/2025 18:45' prior: 0!
IntegratedAIMorph combines all C9AI components into a single unified interface.
Provides local AI responses, query input, response display, verification options, and cleanup functionality.

Usage:
  IntegratedAIMorph demo.
  
Features:
- Local AI responses with built-in knowledge
- Unified query interface
- Cloud AI verification  
- Web search verification
- Computational task execution
- Complete morph cleanup
- Status feedback!

!IntegratedAIMorph methodsFor: 'initialization'!
initialize
	super initialize.
	childMorphs := OrderedCollection new.
	lastQuery := ''.
	lastResponse := ''.
	aiClient := C9AILlamaClient new.
	self setupAppearance.
	self buildInterface.
	self enableDragging! !

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

!IntegratedAIMorph methodsFor: 'interface'!
buildInterface
	| queryContainer |
	self removeAllMorphs.
	
	titleMorph := self buildTitle.
	queryContainer := self buildQueryInput.
	statusMorph := self buildStatusMorph.
	scrollPane := self buildResponsePane.
	
	self addMorphBack: titleMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: queryContainer.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: (self buildButtonRow).
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: statusMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: scrollPane! !

!IntegratedAIMorph methodsFor: 'interface'!
buildTitle
	| title |
	title := StringMorph new
		contents: 'Integrated AI System - Query, Verify & Compute';
		color: (Color r: 0.1 g: 0.3 b: 0.8).
	^ title! !

!IntegratedAIMorph methodsFor: 'interface'!
buildQueryInput
	| container label |
	
	container := Morph new
		color: Color transparent;
		layoutPolicy: TableLayout new;
		listDirection: #topToBottom;
		cellPositioning: #topLeft;
		hResizing: #spaceFill;
		vResizing: #rigid;
		extent: 580@60.
	
	label := StringMorph new
		contents: 'Enter your query:';
		color: (Color r: 0.3 g: 0.3 b: 0.3).
	
	queryInput := PluggableTextMorph new
		extent: 560@35;
		color: Color white;
		borderWidth: 2;
		borderColor: (Color r: 0.7 g: 0.7 b: 0.9);
		hResizing: #spaceFill;
		vResizing: #rigid.
	
	container addMorphBack: label.
	container addMorphBack: (self buildSpacer: 4).
	container addMorphBack: queryInput.
	
	^ container! !

!IntegratedAIMorph methodsFor: 'interface'!
buildButtonRow
	| container |
	
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
buildStatusMorph
	| status |
	status := StringMorph new
		contents: 'Ready - Enter a query and select an action';
		color: (Color r: 0.4 g: 0.4 b: 0.4).
	^ status! !

!IntegratedAIMorph methodsFor: 'interface'!
buildResponsePane
	| pane |
	pane := ScrollPane new
		extent: 580@320;
		color: Color white;
		borderWidth: 2;
		borderColor: (Color r: 0.7 g: 0.7 b: 0.9);
		hResizing: #spaceFill;
		vResizing: #spaceFill.
	
	responseDisplay := self buildResponseDisplay.
	pane scroller addMorph: responseDisplay.
	^ pane! !

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

!IntegratedAIMorph methodsFor: 'interface'!
buildSpacer: height
	^ Morph new
		color: Color transparent;
		extent: 1@height;
		hResizing: #rigid;
		vResizing: #rigid! !

!IntegratedAIMorph methodsFor: 'actions'!
performLocalAI
	| queryText result responseMorph |
	
	queryText := queryInput text asString.
	queryText isEmpty ifTrue: [
		^ self showStatus: 'Enter a query first'].
	
	self showStatus: 'Checking local AI connection...'.
	localAIButton color: Color orange.
	
	[
		"Check if local AI is running"
		(aiClient testHealth) ifFalse: [
			result := 'Local AI (Phi2) is not running or not responding.', String cr, String cr,
				'Please ensure the local AI server is started at: http://127.0.0.1:8080', String cr, String cr,
				'To start the local AI server:', String cr,
				'1. Run your llama.cpp server with Phi2 model', String cr,
				'2. Ensure it is listening on port 8080', String cr,
				'3. Try the Local AI button again', String cr, String cr,
				'You can still use Cloud AI Verify for responses.'.
			self displayResult: 'LOCAL AI CONNECTION ERROR' content: result.
			localAIButton color: (Color r: 0.8 g: 0.3 b: 0.3).
			self showStatus: 'Local AI not available - server not running'.
			^ self].
		
		self showStatus: 'Connecting to local Phi2 AI...'.
		
		"Create ResponseMorph for local AI response"
		responseMorph := ResponseMorph new.
		self registerChildMorph: responseMorph.
		
		"Get response from real local AI"
		result := aiClient completion: queryText.
		
		"Display results"
		self displayResult: 'LOCAL AI RESPONSE (PHI2)' content: result.
		localAIButton color: (Color r: 0.3 g: 0.6 b: 0.9).
		self showStatus: 'Local Phi2 AI response completed'
	] fork! !


!IntegratedAIMorph methodsFor: 'actions'!
handleTemperatureConversion: queryText
	"Handle temperature conversion queries"
	| celsius fahrenheit result tokens number decimalResult |
	
	"Extract numbers from query"
	tokens := queryText findTokens: ' '.
	number := nil.
	tokens do: [:token |
		[number := token asNumber] on: Error do: [:ex | ]].
	
	number ifNil: [
		^ 'Could not find a number in the temperature conversion request. Please specify a temperature like "convert 25 celsius to fahrenheit".'].
	
	"Determine conversion direction"
	((queryText asLowercase includesSubstring: 'celsius') and: [queryText asLowercase includesSubstring: 'fahrenheit']) ifTrue: [
		"Convert C to F"
		fahrenheit := number * 9 / 5 + 32.
		decimalResult := fahrenheit asFloat roundTo: 0.01.
		result := number printString, ' degrees Celsius = ', decimalResult printString, ' degrees Fahrenheit', String cr,
			'Formula used: F = C * 9/5 + 32', String cr,
			'Calculation: ', number printString, ' * 9/5 + 32 = ', decimalResult printString].
	
	((queryText asLowercase includesSubstring: 'fahrenheit') and: [queryText asLowercase includesSubstring: 'celsius']) ifTrue: [
		"Convert F to C"  
		celsius := (number - 32) * 5 / 9.
		decimalResult := celsius asFloat roundTo: 0.01.
		result := number printString, ' degrees Fahrenheit = ', decimalResult printString, ' degrees Celsius', String cr,
			'Formula used: C = (F - 32) * 5/9', String cr,
			'Calculation: (', number printString, ' - 32) * 5/9 = ', decimalResult printString].
	
	result ifNil: [
		result := 'Temperature conversion request detected but could not determine conversion direction. Please specify like "25 celsius to fahrenheit" or "77 fahrenheit to celsius".'].
	
	^ result! !

!IntegratedAIMorph methodsFor: 'actions'!
handleMathExpression: queryText
	"Handle mathematical expressions starting with ="
	| expression result cleanExpression |
	
	"Remove the = prefix and clean up"
	expression := queryText copyFrom: 2 to: queryText size.
	expression := expression withBlanksTrimmed.
	
	expression isEmpty ifTrue: [
		^ 'Empty mathematical expression. Please enter something like "= 22/7" or "= 5 * 8 + 3".'].
	
	cleanExpression := expression.
	
	"Try to evaluate the mathematical expression"
	[
		result := Compiler evaluate: cleanExpression.
		^ 'Mathematical Expression: ', expression, String cr,
			'Result: ', result printString, String cr,
			'Decimal: ', result asFloat printString
	] on: Error do: [:ex |
		^ 'Could not evaluate mathematical expression: "', expression, '"', String cr,
			'Error: ', ex messageText, String cr, String cr,
			'Try simple expressions like:', String cr,
			'- "= 22/7" (division)', String cr,
			'- "= 5 * 8 + 3" (multiplication and addition)', String cr,
			'- "= 2 ** 10" (power)', String cr,
			'- "= (15 + 25) / 4" (with parentheses)']! !

!IntegratedAIMorph methodsFor: 'actions'!
performCloudVerify
	| queryText result morph |
	
	queryText := queryInput text asString.
	queryText isEmpty ifTrue: [
		^ self showStatus: 'Enter a query first'].
	
	self showStatus: 'Calling Cloud AI...'.
	verifyCloudButton color: Color orange.
	
	[
		"Create CloudAI morph and query"
		morph := CloudAIMorph new.
		self registerChildMorph: morph.
		result := morph curlOpenAIWorking: queryText.
		
		"Display results"
		self displayResult: 'CLOUD AI VERIFICATION' content: result.
		verifyCloudButton color: (Color r: 0.2 g: 0.7 b: 0.3).
		self showStatus: 'Cloud AI verification completed'
	] fork! !

!IntegratedAIMorph methodsFor: 'actions'!
performWebSearch
	| queryText result morph |
	
	queryText := queryInput text asString.
	queryText isEmpty ifTrue: [
		^ self showStatus: 'Enter a query first'].
	
	self showStatus: 'Searching web...'.
	verifyWebButton color: Color orange.
	
	[
		"Create Search morph and query"
		morph := SearchMorph new.
		self registerChildMorph: morph.
		result := morph searchFor: queryText.
		
		"Display results"
		self displayResult: 'WEB SEARCH RESULTS' content: result.
		verifyWebButton color: (Color r: 0.3 g: 0.5 b: 0.8).
		self showStatus: 'Web search completed'
	] fork! !

!IntegratedAIMorph methodsFor: 'actions'!
performCompute
	| queryText result taskMorph executorMorph taskType |
	
	queryText := queryInput text asString.
	queryText isEmpty ifTrue: [
		^ self showStatus: 'Enter a query first'].
	
	self showStatus: 'Analyzing computational task...'.
	computeButton color: Color orange.
	
	[
		"Analyze task"
		taskMorph := TaskMorph new.
		self registerChildMorph: taskMorph.
		taskType := taskMorph detectTaskType: queryText.
		
		(taskType = #computational) ifTrue: [
			"Execute computation"
			executorMorph := ExecutorMorph new.
			self registerChildMorph: executorMorph.
			result := executorMorph executeCodeDirectly: queryText.
			self displayResult: 'COMPUTATION RESULTS' content: result.
		] ifFalse: [
			result := 'No computational task detected in: "', queryText, '"', String cr,
				'Task type detected: ', taskType printString, String cr, String cr,
				'This query does not appear to need mathematical computation.', String cr,
				'Try queries like:', String cr,
				'- "= 22/7" (mathematical expressions)', String cr,
				'- "convert 100 celsius to fahrenheit"', String cr,
				'- "calculate 15 percent of 200"', String cr,
				'- "what is 25 squared"'.
			self displayResult: 'TASK ANALYSIS' content: result].
		
		computeButton color: (Color r: 0.7 g: 0.4 b: 0.2).
		self showStatus: 'Computation completed'
	] fork! !

!IntegratedAIMorph methodsFor: 'actions'!
clearAllMorphs
	"Clear all C9AI morphs from the world"
	| count worldMorphs |
	
	count := 0.
	self showStatus: 'Clearing all AI morphs...'.
	clearButton color: Color orange.
	
	"Get all morphs in world"
	worldMorphs := World submorphs copy.
	
	"Remove C9AI morphs"
	worldMorphs do: [:morph |
		((morph class name includesSubstring: 'Morph') and: [
			morph class name includesSubstring: 'C9AI' or: [
			morph class name includesAnyOf: #('QueryMorph' 'TaskMorph' 'ExecutorMorph' 'ResponseMorph' 'SearchMorph' 'CloudAIMorph' 'IntegratedAIMorph')]]) ifTrue: [
			morph ~= self ifTrue: [
				morph delete.
				count := count + 1]]].
	
	"Clear registered child morphs"
	childMorphs removeAll.
	
	"Reset response display"
	responseDisplay setText: 'All AI morphs cleared (', count printString, ' morphs removed)', String cr, String cr,
		'System ready for new queries.'.
	scrollPane changed.
	
	clearButton color: (Color r: 0.8 g: 0.2 b: 0.2).
	self showStatus: 'Cleared ', count printString, ' morphs - System reset'! !

!IntegratedAIMorph methodsFor: 'display'!
displayResult: titleText content: contentText
	| timestamp cleanContent result underline separator |
	
	timestamp := DateAndTime now asString.
	
	"Log debug info to Transcript"
	Transcript show: '=== ', titleText, ' ==='; cr.
	Transcript show: 'Time: ', timestamp; cr.
	Transcript show: 'Query: "', (queryInput text asString), '"'; cr; cr.
	
	"Extract clean response for display"
	cleanContent := self extractCleanResponse: titleText from: contentText.
	
	"Simple clean display format"
	underline := String new: titleText size withAll: $=.
	separator := String new: 30 withAll: $-.
	
	result := titleText, String cr,
		underline, String cr, String cr,
		cleanContent, String cr, String cr,
		separator.
	
	"Add to existing content"
	lastResponse := lastResponse, String cr, String cr, result.
	responseDisplay setText: lastResponse.
	scrollPane changed! !

!IntegratedAIMorph methodsFor: 'display'!
showStatus: statusText
	statusMorph contents: statusText.
	statusMorph color: (Color r: 0.2 g: 0.6 b: 0.2)! !

!IntegratedAIMorph methodsFor: 'display'!
extractCleanResponse: titleText from: contentText
	"Extract clean AI response, filtering out debug information"
	| lines cleanLines inExtractedSection extractedContent startFound |
	
	titleText = 'LOCAL AI RESPONSE' ifTrue: [
		"For local AI, return content as-is since it's already clean"
		^ contentText].
	
	titleText = 'CLOUD AI VERIFICATION' ifTrue: [
		"For Cloud AI, extract only the EXTRACTED AI RESPONSE section"
		lines := contentText findTokens: String cr.
		cleanLines := OrderedCollection new.
		inExtractedSection := false.
		startFound := false.
		
		lines do: [:eachLine |
			"Look for start of extracted section"
			(eachLine includesSubstring: 'EXTRACTED AI RESPONSE:') ifTrue: [
				startFound := true.
				inExtractedSection := false]. "Skip the header line"
			
			"Start collecting after the first === line following the header"
			startFound ifTrue: [
				(eachLine includesSubstring: '========================') ifTrue: [
					inExtractedSection ifTrue: [
						"End of extracted section - we found second ==="
						inExtractedSection := false]
					ifFalse: [
						"Start of extracted section - we found first ==="
						inExtractedSection := true]].
				
				"Collect lines in the extracted section"
				inExtractedSection ifTrue: [
					(eachLine includesSubstring: '========================') ifFalse: [
						eachLine isEmpty ifFalse: [
							cleanLines add: eachLine]]]]].
		
		extractedContent := ''.
		cleanLines do: [:cleanLine |
			extractedContent := extractedContent, cleanLine, String cr].
		
		"Remove trailing line break"
		extractedContent isEmpty ifFalse: [
			extractedContent := extractedContent copyFrom: 1 to: extractedContent size - 1].
		
		extractedContent isEmpty ifTrue: [
			"Fallback - log full content to Transcript and show error"
			Transcript show: 'CLOUD AI PARSING FAILED - FULL CONTENT:'; cr.
			Transcript show: contentText; cr; cr.
			^ 'Cloud AI response could not be parsed. Check Transcript for full details.']
		ifFalse: [
			"Log success to Transcript"
			Transcript show: 'CLOUD AI EXTRACTED: "', extractedContent, '"'; cr.
			^ extractedContent]].
	
	"For other response types, return as-is"
	^ contentText! !

!IntegratedAIMorph methodsFor: 'utilities'!
registerChildMorph: morph
	"Register a child morph for cleanup"
	childMorphs add: morph! !

!IntegratedAIMorph methodsFor: 'interaction'!
enableDragging
	self on: #mouseDown send: #startDrag: to: self.
	self on: #mouseMove send: #drag: to: self.
	self on: #mouseUp send: #endDrag: to: self! !

!IntegratedAIMorph methodsFor: 'interaction'!
startDrag: event
	self isDragging: true.
	self dragOffset: event position - self position! !

!IntegratedAIMorph methodsFor: 'interaction'!
drag: event
	self isDragging ifTrue: [
		self position: event position - self dragOffset]! !

!IntegratedAIMorph methodsFor: 'interaction'!
endDrag: event
	self isDragging: false! !

!IntegratedAIMorph methodsFor: 'accessing'!
isDragging
	^ self valueOfProperty: #isDragging ifAbsent: [false]! !

!IntegratedAIMorph methodsFor: 'accessing'!
isDragging: aBoolean
	self setProperty: #isDragging toValue: aBoolean! !

!IntegratedAIMorph methodsFor: 'accessing'!
dragOffset
	^ self valueOfProperty: #dragOffset ifAbsent: [0@0]! !

!IntegratedAIMorph methodsFor: 'accessing'!
dragOffset: aPoint
	self setProperty: #dragOffset toValue: aPoint! !

!IntegratedAIMorph class methodsFor: 'instance creation'!
demo
	"Create and show the integrated AI system"
	^ self new openInWorld! !

!IntegratedAIMorph class methodsFor: 'instance creation'!
clearAll
	"Clear all C9AI morphs from the world"
	| count worldMorphs |
	
	count := 0.
	worldMorphs := World submorphs copy.
	
	worldMorphs do: [:morph |
		((morph class name includesSubstring: 'Morph') and: [
			morph class name includesSubstring: 'C9AI' or: [
			morph class name includesAnyOf: #('QueryMorph' 'TaskMorph' 'ExecutorMorph' 'ResponseMorph' 'SearchMorph' 'CloudAIMorph' 'IntegratedAIMorph')]]) ifTrue: [
			morph delete.
			count := count + 1]].
	
	Transcript show: 'Cleared ', count printString, ' AI morphs from world'; cr.
	^ count! !