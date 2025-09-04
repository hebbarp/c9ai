Morph subclass: #IntegratedAIMorph
	instanceVariableNames: 'titleMorph queryInput responseDisplay verifyCloudButton verifyWebButton computeButton clearButton statusMorph scrollPane lastQuery lastResponse childMorphs'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!IntegratedAIMorph commentStamp: 'C9AI 8/24/2025 18:30' prior: 0!
IntegratedAIMorph combines all C9AI components into a single unified interface.
Provides query input, response display, verification options, and cleanup functionality.

Usage:
  IntegratedAIMorph new openInWorld.
  
Features:
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
	self setupAppearance.
	self buildInterface.
	self enableDragging! !

!IntegratedAIMorph methodsFor: 'initialization'!
setupAppearance
	self color: (Color r: 0.98 g: 0.98 b: 1.0).
	self borderWidth: 3.
	self borderColor: (Color r: 0.2 g: 0.4 b: 0.9).
	self extent: 600@500.
	self layoutPolicy: TableLayout new.
	self listDirection: #topToBottom.
	self cellPositioning: #topLeft.
	self hResizing: #spaceFill.
	self vResizing: #spaceFill.
	self layoutInset: 12! !

!IntegratedAIMorph methodsFor: 'interface'!
buildInterface
	self removeAllMorphs.
	
	titleMorph := self buildTitle.
	queryInput := self buildQueryInput.
	statusMorph := self buildStatusMorph.
	scrollPane := self buildResponsePane.
	
	self addMorphBack: titleMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: queryInput.
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
	| container label input |
	
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
	
	input := PluggableTextMorph new
		extent: 560@35;
		color: Color white;
		borderWidth: 2;
		borderColor: (Color r: 0.7 g: 0.7 b: 0.9);
		hResizing: #spaceFill;
		vResizing: #rigid.
	
	container addMorphBack: label.
	container addMorphBack: (self buildSpacer: 4).
	container addMorphBack: input.
	
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
	
	container addMorphBack: verifyCloudButton.
	container addMorphBack: (self buildSpacer: 8).
	container addMorphBack: verifyWebButton.
	container addMorphBack: (self buildSpacer: 8).
	container addMorphBack: computeButton.
	container addMorphBack: (self buildSpacer: 8).
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
			'• Cloud AI Verify - Cross-check with OpenAI GPT', String cr,
			'• Web Search - Verify facts with web search', String cr,
			'• Compute - Execute computational tasks', String cr,
			'• Clear All - Remove all created morphs', String cr, String cr,
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
	| queryText result taskMorph executorMorph |
	
	queryText := queryInput text asString.
	queryText isEmpty ifTrue: [
		^ self showStatus: 'Enter a query first'].
	
	self showStatus: 'Analyzing computational task...'.
	computeButton color: Color orange.
	
	[
		"Analyze task"
		taskMorph := TaskMorph new.
		self registerChildMorph: taskMorph.
		
		(taskMorph needsComputation: queryText) ifTrue: [
			"Execute computation"
			executorMorph := ExecutorMorph new.
			self registerChildMorph: executorMorph.
			result := executorMorph executeTask: queryText.
			self displayResult: 'COMPUTATION RESULTS' content: result.
		] ifFalse: [
			result := 'No computational task detected in: "', queryText, '"', String cr,
				'This query does not appear to need mathematical computation.', String cr,
				'Try queries like:', String cr,
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
	| timestamp result |
	
	timestamp := DateAndTime now asString.
	result := titleText, String cr,
		'=' copyReplicated: titleText size, String cr,
		'Time: ', timestamp, String cr, String cr,
		contentText, String cr, String cr,
		'Query: "', (queryInput text asString), '"', String cr,
		'-' copyReplicated: 50.
	
	"Add to existing content"
	lastResponse := lastResponse, String cr, String cr, result.
	responseDisplay setText: lastResponse.
	scrollPane changed! !

!IntegratedAIMorph methodsFor: 'display'!
showStatus: statusText
	statusMorph contents: statusText.
	statusMorph color: (Color r: 0.2 g: 0.6 b: 0.2)! !

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