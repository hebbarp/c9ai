Morph subclass: #QueryMorph
	instanceVariableNames: 'titleMorph inputMorph sendButton aiClient'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!QueryMorph commentStamp: 'C9AI 8/24/2025 16:10' prior: 0!
A floating query input morph for sending prompts to AI.
Now integrated with TaskMorph for intelligent task analysis.
Can be placed anywhere in the Squeak world and used independently.

Usage:
  QueryMorph new openInWorld.!

!QueryMorph methodsFor: 'initialization'!
initialize
	super initialize.
	aiClient := C9AILlamaClient new.
	self setupAppearance.
	self buildInterface.
	self enableDragging! !

!QueryMorph methodsFor: 'initialization'!
setupAppearance
	self color: (Color r: 0.95 g: 0.95 b: 0.98).
	self borderWidth: 2.
	self borderColor: (Color r: 0.3 g: 0.4 b: 0.7).
	self extent: 350@140.
	self layoutPolicy: TableLayout new.
	self listDirection: #topToBottom.
	self cellPositioning: #center.
	self hResizing: #rigid.
	self vResizing: #rigid.
	self layoutInset: 8! !

!QueryMorph methodsFor: 'interface'!
buildInterface
	self removeAllMorphs.
	
	titleMorph := self buildTitle.
	inputMorph := self buildInput.
	sendButton := self buildSendButton.
	
	self addMorphBack: titleMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: inputMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: sendButton! !

!QueryMorph methodsFor: 'interface'!
buildTitle
	| title |
	title := StringMorph new
		contents: 'AI Query (= for code)';
		color: (Color r: 0.2 g: 0.3 b: 0.6).
	^ title! !

!QueryMorph methodsFor: 'interface'!
buildInput
	| input |
	input := PluggableTextMorph new
		extent: 300@60;
		color: Color white;
		borderWidth: 1;
		borderColor: Color gray.
	^ input! !

!QueryMorph methodsFor: 'interface'!
buildSendButton
	| button |
	button := SimpleButtonMorph new
		label: 'Analyze & Send';
		target: self;
		actionSelector: #sendQuery;
		color: (Color r: 0.3 g: 0.6 b: 0.3);
		extent: 140@25.
	^ button! !

!QueryMorph methodsFor: 'interface'!
buildSpacer: height
	"Create a transparent spacer morph"
	^ Morph new
		color: Color transparent;
		extent: 1@height;
		hResizing: #rigid;
		vResizing: #rigid! !

!QueryMorph methodsFor: 'actions'!
sendQuery
	"Send the query to TaskMorph for analysis, then to AI"
	| queryText taskMorph analysis response |
	queryText := inputMorph text asString.
	queryText isEmpty ifTrue: [^ self showMessage: 'Enter a query first'].
	
	self showMessage: 'Analyzing task...'.
	sendButton color: Color orange.
	
	[
	"Find or create TaskMorph"
	taskMorph := self findOrCreateTaskMorph.
	
	"Analyze the query"
	analysis := taskMorph analyzeQuery: queryText.
	
	"Process based on task type"
	self processTask: analysis.
	
	sendButton color: (Color r: 0.3 g: 0.6 b: 0.3)
	] fork! !

!QueryMorph methodsFor: 'actions'!
findOrCreateTaskMorph
	"Find existing TaskMorph or create one"
	| taskMorph newPosition |
	
	taskMorph := World submorphs detect: [:morph | morph isKindOf: TaskMorph] ifNone: [nil].
	
	taskMorph ifNil: [
		"Create TaskMorph positioned below this QueryMorph"
		newPosition := self position + (0 @ (self height + 20)).
		taskMorph := TaskMorph new.
		taskMorph position: newPosition.
		taskMorph openInWorld].
	
	^ taskMorph! !

!QueryMorph methodsFor: 'actions'!
findOrCreateExecutorMorph
	"Find existing ExecutorMorph or create one"
	| executorMorph newPosition |
	
	executorMorph := World submorphs detect: [:morph | morph isKindOf: ExecutorMorph] ifNone: [nil].
	
	executorMorph ifNil: [
		"Create ExecutorMorph positioned to the left of QueryMorph"
		newPosition := self position + (-320 @ 0).
		executorMorph := ExecutorMorph new.
		executorMorph position: newPosition.
		executorMorph openInWorld].
	
	^ executorMorph! !

!QueryMorph methodsFor: 'actions'!
processTask: analysis
	"Process the analyzed task based on its type"
	| taskType queryText |
	taskType := analysis at: #type.
	queryText := analysis at: #query.
	
	taskType = #computational ifTrue: [
		^ self processComputationalTask: analysis].
	
	taskType = #factual ifTrue: [
		^ self processFactualTask: analysis].
	
	taskType = #conversational ifTrue: [
		^ self processConversationalTask: analysis].
	
	"Default: treat as conversational"
	^ self processConversationalTask: analysis! !

!QueryMorph methodsFor: 'task-processing'!
processComputationalTask: analysis
	"Process computational tasks - execute code with ExecutorMorph"
	| code result queryText executorMorph computedResult |
	queryText := analysis at: #query.
	code := analysis at: #code ifAbsent: [queryText].
	
	self showMessage: 'Executing: ', code.
	
	"Find or create ExecutorMorph"
	executorMorph := self findOrCreateExecutorMorph.
	
	"Execute the code"
	computedResult := executorMorph executeCodeDirectly: code.
	
	"Format nice response"
	result := 'COMPUTED RESULT: ', computedResult, String cr, String cr,
		'Code executed: ', code.
	
	self sendToResponseMorph: queryText answer: result! !

!QueryMorph methodsFor: 'task-processing'!
processFactualTask: analysis
	"Process factual tasks - should do web search"
	| searchTerms result queryText |
	queryText := analysis at: #query.
	searchTerms := analysis at: #searchTerms ifAbsent: [queryText].
	
	self showMessage: 'Would search: ', searchTerms.
	
	"For now, warn about potential hallucination"
	result := 'FACTUAL QUERY DETECTED: "', searchTerms, '" - Web search needed to verify facts and prevent hallucination. Current AI response may be inaccurate.', String cr, String cr,
		'Proceeding with AI response (unverified):'.
	
	"Still send to AI but with warning"
	self sendToAI: queryText withPrefix: result! !

!QueryMorph methodsFor: 'task-processing'!
processConversationalTask: analysis
	"Process conversational tasks - normal AI response"
	| queryText |
	queryText := analysis at: #query.
	self showMessage: 'Processing conversation...'.
	self sendToAI: queryText withPrefix: ''! !

!QueryMorph methodsFor: 'ai-integration'!
sendToAI: queryText withPrefix: prefix
	"Send query to AI with optional prefix"
	| response fullResponse |
	
	[response := aiClient completion: queryText.
	 fullResponse := prefix isEmpty 
		ifTrue: [response]
		ifFalse: [prefix, String cr, String cr, response].
	 self sendToResponseMorph: queryText answer: fullResponse]
		on: Error
		do: [:ex | self sendToResponseMorph: queryText answer: 'AI Error: ', ex messageText]! !

!QueryMorph methodsFor: 'ai-integration'!
sendToResponseMorph: queryText answer: responseText
	"Send the result to ResponseMorph"
	| responseMorph newPosition |
	
	"Find existing ResponseMorph or create one"
	responseMorph := World submorphs detect: [:morph | morph isKindOf: ResponseMorph] ifNone: [nil].
	
	responseMorph ifNil: [
		newPosition := self position + (self width + 20 @ 0).
		responseMorph := ResponseMorph new.
		responseMorph position: newPosition.
		responseMorph openInWorld].
	
	"Add this conversation"
	responseMorph showResponse: queryText answer: responseText.
	
	"Clear the input for next query"
	inputMorph setText: ''.
	
	"Also show in Transcript"
	Transcript show: '=== Query Complete ==='; cr.
	Transcript show: 'Q: ', queryText; cr.
	Transcript show: 'A: ', responseText; cr.
	Transcript show: '==================='; cr.
	
	self showMessage: 'Analysis & response complete'! !

!QueryMorph methodsFor: 'feedback'!
showMessage: messageText
	"Show a temporary message in the title"
	| originalContents |
	originalContents := titleMorph contents.
	titleMorph contents: messageText.
	titleMorph color: Color blue.
	
	"Reset after 3 seconds"
	[(Delay forSeconds: 3) wait.
	 titleMorph contents: originalContents.
	 titleMorph color: (Color r: 0.2 g: 0.3 b: 0.6)]
		fork! !

!QueryMorph methodsFor: 'interaction'!
enableDragging
	"Make the morph draggable"
	self on: #mouseDown send: #startDrag: to: self.
	self on: #mouseMove send: #drag: to: self.
	self on: #mouseUp send: #endDrag: to: self! !

!QueryMorph methodsFor: 'interaction'!
startDrag: event
	"Start dragging the morph"
	self isDragging: true.
	self dragOffset: event position - self position! !

!QueryMorph methodsFor: 'interaction'!
drag: event
	"Drag the morph around"
	self isDragging ifTrue: [
		self position: event position - self dragOffset
	]! !

!QueryMorph methodsFor: 'interaction'!
endDrag: event
	"End dragging"
	self isDragging: false! !

!QueryMorph methodsFor: 'accessing'!
isDragging
	"Check if currently being dragged"
	^ self valueOfProperty: #isDragging ifAbsent: [false]! !

!QueryMorph methodsFor: 'accessing'!
isDragging: aBoolean
	"Set dragging state"
	self setProperty: #isDragging toValue: aBoolean! !

!QueryMorph methodsFor: 'accessing'!
dragOffset
	"Get drag offset"
	^ self valueOfProperty: #dragOffset ifAbsent: [0@0]! !

!QueryMorph methodsFor: 'accessing'!
dragOffset: aPoint
	"Set drag offset"
	self setProperty: #dragOffset toValue: aPoint! !

!QueryMorph class methodsFor: 'instance creation'!
demo
	"Create and show an integrated QueryMorph"
	^ self new openInWorld! !