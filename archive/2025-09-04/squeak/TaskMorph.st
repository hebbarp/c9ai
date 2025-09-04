Morph subclass: #TaskMorph
	instanceVariableNames: 'titleMorph statusMorph taskList scrollPane aiClient'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!TaskMorph commentStamp: 'C9AI 8/24/2025 16:00' prior: 0!
TaskMorph analyzes queries and determines the appropriate action:
- Computational tasks: Generate Smalltalk code for execution
- Factual queries: Trigger web search or knowledge lookup  
- Conversational: Pass to normal AI response

Usage:
  TaskMorph new openInWorld.!

!TaskMorph methodsFor: 'initialization'!
initialize
	super initialize.
	aiClient := C9AILlamaClient new.
	taskList := OrderedCollection new.
	self setupAppearance.
	self buildInterface.
	self enableDragging! !

!TaskMorph methodsFor: 'initialization'!
setupAppearance
	self color: (Color r: 0.95 g: 0.98 b: 0.95).
	self borderWidth: 2.
	self borderColor: (Color r: 0.6 g: 0.3 b: 0.6).
	self extent: 350@300.
	self layoutPolicy: TableLayout new.
	self listDirection: #topToBottom.
	self cellPositioning: #topLeft.
	self hResizing: #rigid.
	self vResizing: #rigid.
	self layoutInset: 8! !

!TaskMorph methodsFor: 'interface'!
buildInterface
	self removeAllMorphs.
	
	titleMorph := self buildTitle.
	statusMorph := self buildStatus.
	scrollPane := self buildTaskPane.
	
	self addMorphBack: titleMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: statusMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: scrollPane! !

!TaskMorph methodsFor: 'interface'!
buildTitle
	| title |
	title := StringMorph new
		contents: 'AI Task Analyzer';
		color: (Color r: 0.5 g: 0.2 b: 0.5).
	^ title! !

!TaskMorph methodsFor: 'interface'!
buildStatus
	| status |
	status := StringMorph new
		contents: 'Ready to analyze queries';
		color: (Color r: 0.3 g: 0.3 b: 0.3).
	^ status! !

!TaskMorph methodsFor: 'interface'!
buildTaskPane
	| pane |
	pane := ScrollPane new
		extent: 320@200;
		color: Color white;
		borderWidth: 1;
		borderColor: Color gray.
	
	"Store reference before updating display"
	scrollPane := pane.
	self updateTaskDisplay.
	^ pane! !

!TaskMorph methodsFor: 'interface'!
buildSpacer: height
	"Create a transparent spacer morph"
	^ Morph new
		color: Color transparent;
		extent: 1@height;
		hResizing: #rigid;
		vResizing: #rigid! !

!TaskMorph methodsFor: 'task-analysis'!
analyzeQuery: queryText
	"Analyze a query using sigil-based detection"
	| taskType analysis |
	
	self showStatus: 'Analyzing query...'.
	
	"Check for computation sigil first"
	taskType := (queryText beginsWith: '= ')
		ifTrue: [#computational]
		ifFalse: [#conversational].
	
	"Generate appropriate action based on task type"
	analysis := self generateTaskAction: queryText type: taskType.
	
	"Add to task list"
	self addTask: analysis.
	
	self showStatus: 'Analysis complete: ', taskType.
	^ analysis! !

!TaskMorph methodsFor: 'task-analysis'!
detectTaskType: queryText
	"Detect the type of task from the query text"
	| lowerQuery |
	lowerQuery := queryText asLowercase.
	
	"Mathematical computations (check BEFORE 'what is' pattern)"
	(lowerQuery includesSubstring: 'factorial') ifTrue: [^ #computational].
	(lowerQuery includesSubstring: '+') ifTrue: [^ #computational].
	(lowerQuery includesSubstring: '-') ifTrue: [^ #computational].
	(lowerQuery includesSubstring: '*') ifTrue: [^ #computational].
	(lowerQuery includesSubstring: '/') ifTrue: [^ #computational].
	(lowerQuery includesSubstring: 'calculate') ifTrue: [^ #computational].
	(lowerQuery includesSubstring: 'compute') ifTrue: [^ #computational].
	(lowerQuery includesSubstring: 'sum') ifTrue: [^ #computational].
	
	"Factual queries (specific who/when/where patterns)"
	(lowerQuery includesSubstring: 'who founded') ifTrue: [^ #factual].
	(lowerQuery includesSubstring: 'who started') ifTrue: [^ #factual].
	(lowerQuery includesSubstring: 'who invented') ifTrue: [^ #factual].
	(lowerQuery includesSubstring: 'who is the founder') ifTrue: [^ #factual].
	(lowerQuery includesSubstring: 'who is the inventor') ifTrue: [^ #factual].
	(lowerQuery includesSubstring: 'who created') ifTrue: [^ #factual].
	(lowerQuery includesSubstring: 'when was') ifTrue: [^ #factual].
	(lowerQuery includesSubstring: 'where is') ifTrue: [^ #factual].
	
	"Default to conversational"
	^ #conversational! !

!TaskMorph methodsFor: 'task-analysis'!
generateTaskAction: queryText type: taskType
	"Generate specific action based on task type"
	| action code |
	action := Dictionary new.
	action at: #query put: queryText.
	action at: #type put: taskType.
	action at: #timestamp put: DateAndTime now.
	
	taskType = #computational ifTrue: [
		"Extract code after = sigil"
		code := queryText copyFrom: 3 to: queryText size.
		"Check for unit conversions and transform code"
		code := self transformUnitConversions: code.
		action at: #action put: 'Execute Smalltalk code directly'.
		action at: #code put: code.
		^ action].
	
	taskType = #conversational ifTrue: [
		action at: #action put: 'Process with normal AI response'.
		^ action].
	
	^ action! !

!TaskMorph methodsFor: 'code-generation'!
generateSmalltalkCode: queryText
	"Generate Smalltalk code for computational queries"
	| lowerQuery |
	lowerQuery := queryText asLowercase.
	
	"Handle factorial queries"
	(lowerQuery includesSubstring: 'factorial') ifTrue: [
		| number |
		"Extract number from query"
		number := self extractNumber: queryText.
		number ifNotNil: [
			^ number printString, ' factorial'].
	].
	
	"Handle arithmetic expressions like 22/7, 2+3, etc."
	(lowerQuery includesSubstring: '/') ifTrue: [
		^ self extractArithmetic: queryText].
	(lowerQuery includesSubstring: '+') ifTrue: [
		^ self extractArithmetic: queryText].
	(lowerQuery includesSubstring: '*') ifTrue: [
		^ self extractArithmetic: queryText].
	(lowerQuery includesSubstring: '-') ifTrue: [
		^ self extractArithmetic: queryText].
	
	"Default: return the query as potential code"
	^ queryText! !

!TaskMorph methodsFor: 'code-generation'!
extractNumber: text
	"Extract a number from text"
	| words |
	[words := text findTokens: ' '.
	 words do: [:word |
		[word isAllDigits ifTrue: [
			^ word asNumber]] on: Error do: [:ex | "ignore non-numeric"]].
	] on: Error do: [:ex | ^ nil].
	^ nil! !

!TaskMorph methodsFor: 'code-generation'!
extractArithmetic: text
	"Extract arithmetic expression from text"
	| tokens expression |
	
	"Look for patterns like '22/7', '2+3', etc."
	tokens := text findTokens: ' '.
	tokens do: [:token |
		"Check if token contains arithmetic operators"
		((token includes: $/) or: [(token includes: $+) or: [(token includes: $*) or: [token includes: $-]]]) ifTrue: [
			"Verify it looks like number operator number"
			(self isValidArithmetic: token) ifTrue: [
				^ token]]].
	
	"Fallback: return original text"
	^ text! !

!TaskMorph methodsFor: 'code-generation'!
isValidArithmetic: token
	"Check if token is valid arithmetic like 22/7, 3+4"
	| parts |
	
	"Try division first"
	(token includes: $/) ifTrue: [
		parts := token findTokens: '/'.
		(parts size = 2) ifTrue: [
			^ (parts first isAllDigits) and: [parts second isAllDigits]]].
	
	"Try addition"
	(token includes: $+) ifTrue: [
		parts := token findTokens: '+'.
		(parts size = 2) ifTrue: [
			^ (parts first isAllDigits) and: [parts second isAllDigits]]].
	
	"Try multiplication"  
	(token includes: $*) ifTrue: [
		parts := token findTokens: '*'.
		(parts size = 2) ifTrue: [
			^ (parts first isAllDigits) and: [parts second isAllDigits]]].
	
	"Try subtraction"
	(token includes: $-) ifTrue: [
		parts := token findTokens: '-'.
		(parts size = 2) ifTrue: [
			^ (parts first isAllDigits) and: [parts second isAllDigits]]].
	
	^ false! !

!TaskMorph methodsFor: 'code-transformation'!
transformUnitConversions: code
	"Transform unit conversion patterns into executable Smalltalk"
	| trimmedCode tokens |
	trimmedCode := self removeWhitespace: code.
	tokens := trimmedCode findTokens: ' '.
	
	"Temperature conversions"
	((tokens includes: 'celsius') and: [tokens includes: 'fahrenheit']) ifTrue: [
		^ self transformTemperature: trimmedCode].
	
	"Distance conversions"
	((tokens includes: 'miles') and: [tokens includes: 'kilometers']) ifTrue: [
		^ self transformDistance: trimmedCode].
	
	"Weight conversions"
	((tokens includes: 'pounds') and: [tokens includes: 'kilograms']) ifTrue: [
		^ self transformWeight: trimmedCode].
	
	"No conversion pattern found - return as-is"
	^ code! !

!TaskMorph methodsFor: 'code-transformation'!
transformTemperature: code
	"Transform temperature conversions"
	| number |
	
	"Pattern: 100 celsius fahrenheit"
	(code includesSubstring: 'celsius fahrenheit') ifTrue: [
		number := self extractNumberFromStart: code.
		number ifNotNil: [
			^ '(', number printString, ' * 9 / 5 + 32) asFloat'].
	].
	
	"Pattern: 100 fahrenheit celsius"
	(code includesSubstring: 'fahrenheit celsius') ifTrue: [
		number := self extractNumberFromStart: code.
		number ifNotNil: [
			^ '((', number printString, ' - 32) * 5 / 9) asFloat'].
	].
	
	^ code! !

!TaskMorph methodsFor: 'code-transformation'!
transformDistance: code
	"Transform distance conversions"
	| number |
	
	"Pattern: 100 miles kilometers"
	(code includesSubstring: 'miles kilometers') ifTrue: [
		number := self extractNumberFromStart: code.
		number ifNotNil: [
			^ '(', number printString, ' * 1.60934) asFloat'].
	].
	
	"Pattern: 100 kilometers miles"
	(code includesSubstring: 'kilometers miles') ifTrue: [
		number := self extractNumberFromStart: code.
		number ifNotNil: [
			^ '(', number printString, ' / 1.60934) asFloat'].
	].
	
	^ code! !

!TaskMorph methodsFor: 'code-transformation'!
transformWeight: code
	"Transform weight conversions"
	| number |
	
	"Pattern: 100 pounds kilograms"
	(code includesSubstring: 'pounds kilograms') ifTrue: [
		number := self extractNumberFromStart: code.
		number ifNotNil: [
			^ '(', number printString, ' * 0.453592) asFloat'].
	].
	
	"Pattern: 100 kilograms pounds"
	(code includesSubstring: 'kilograms pounds') ifTrue: [
		number := self extractNumberFromStart: code.
		number ifNotNil: [
			^ '(', number printString, ' / 0.453592) asFloat'].
	].
	
	^ code! !

!TaskMorph methodsFor: 'code-transformation'!
extractNumberFromStart: text
	"Extract the first number from text like '100 celsius fahrenheit'"
	| tokens |
	tokens := text findTokens: ' '.
	tokens do: [:token |
		[^ token asNumber] on: Error do: [].
	].
	^ nil! !

!TaskMorph methodsFor: 'code-transformation'!
removeWhitespace: text
	"Remove leading and trailing whitespace - Squeak compatible version"
	| result start end |
	text ifEmpty: [^ text].
	
	"Find first non-whitespace character"
	start := 1.
	[start <= text size and: [(text at: start) isSeparator]]
		whileTrue: [start := start + 1].
	
	"Find last non-whitespace character"
	end := text size.
	[end >= 1 and: [(text at: end) isSeparator]]
		whileTrue: [end := end - 1].
	
	"Return trimmed string or empty if all whitespace"
	(start > end) 
		ifTrue: [^ '']
		ifFalse: [^ text copyFrom: start to: end]! !

!TaskMorph methodsFor: 'search-generation'!
extractSearchTerms: queryText
	"Extract search terms from factual queries"
	| searchTerms |
	searchTerms := queryText.
	
	"Remove question words"
	searchTerms := searchTerms copyReplaceAll: 'who founded ' with: ''.
	searchTerms := searchTerms copyReplaceAll: 'who started ' with: ''.
	searchTerms := searchTerms copyReplaceAll: 'who invented ' with: ''.
	searchTerms := searchTerms copyReplaceAll: 'what is ' with: ''.
	searchTerms := searchTerms copyReplaceAll: 'when was ' with: ''.
	searchTerms := searchTerms copyReplaceAll: 'where is ' with: ''.
	
	^ searchTerms! !

!TaskMorph methodsFor: 'task-management'!
addTask: taskAnalysis
	"Add a task analysis to the list"
	taskList add: taskAnalysis.
	self updateTaskDisplay.
	
	"Log to transcript"
	Transcript show: '=== TaskMorph Analysis ==='; cr.
	Transcript show: 'Query: ', (taskAnalysis at: #query); cr.
	Transcript show: 'Type: ', (taskAnalysis at: #type) printString; cr.
	Transcript show: 'Action: ', (taskAnalysis at: #action); cr.
	Transcript show: '========================'; cr! !

!TaskMorph methodsFor: 'task-management'!
updateTaskDisplay
	"Update the scrollable task display"
	| content |
	content := self formatTaskList.
	
	scrollPane scroller removeAllMorphs.
	scrollPane scroller addMorph: (PluggableTextMorph new
		setText: content;
		extent: 300@180;
		color: Color white;
		readOnly: true;
		wrapFlag: true)! !

!TaskMorph methodsFor: 'task-management'!
formatTaskList
	"Format task list for display"
	| formatted |
	taskList isEmpty ifTrue: [^ 'No tasks analyzed yet. Use QueryMorph to send queries.'].
	
	formatted := String new.
	taskList doWithIndex: [:task :index |
		formatted := formatted,
			'TASK #', index printString, String cr,
			'Query: ', (task at: #query), String cr,
			'Type: ', (task at: #type) printString, String cr,
			'Action: ', (task at: #action), String cr.
		
		"Show generated code if computational"
		(task at: #type) = #computational ifTrue: [
			formatted := formatted, 'Code: ', (task at: #code ifAbsent: ['none']), String cr].
		
		"Show search terms if factual"
		(task at: #type) = #factual ifTrue: [
			formatted := formatted, 'Search: ', (task at: #searchTerms ifAbsent: ['none']), String cr].
		
		formatted := formatted, String cr].
	
	^ formatted! !

!TaskMorph methodsFor: 'feedback'!
showStatus: messageText
	"Show status in the status morph"
	statusMorph contents: messageText.
	statusMorph color: Color blue.
	
	"Reset after 3 seconds"
	[(Delay forSeconds: 3) wait.
	 statusMorph contents: 'Ready to analyze queries'.
	 statusMorph color: (Color r: 0.3 g: 0.3 b: 0.3)]
		fork! !

!TaskMorph methodsFor: 'interaction'!
enableDragging
	"Make the morph draggable"
	self on: #mouseDown send: #startDrag: to: self.
	self on: #mouseMove send: #drag: to: self.
	self on: #mouseUp send: #endDrag: to: self! !

!TaskMorph methodsFor: 'interaction'!
startDrag: event
	"Start dragging the morph"
	self isDragging: true.
	self dragOffset: event position - self position! !

!TaskMorph methodsFor: 'interaction'!
drag: event
	"Drag the morph around"
	self isDragging ifTrue: [
		self position: event position - self dragOffset
	]! !

!TaskMorph methodsFor: 'interaction'!
endDrag: event
	"End dragging"
	self isDragging: false! !

!TaskMorph methodsFor: 'accessing'!
isDragging
	"Check if currently being dragged"
	^ self valueOfProperty: #isDragging ifAbsent: [false]! !

!TaskMorph methodsFor: 'accessing'!
isDragging: aBoolean
	"Set dragging state"
	self setProperty: #isDragging toValue: aBoolean! !

!TaskMorph methodsFor: 'accessing'!
dragOffset
	"Get drag offset"
	^ self valueOfProperty: #dragOffset ifAbsent: [0@0]! !

!TaskMorph methodsFor: 'accessing'!
dragOffset: aPoint
	"Set drag offset"
	self setProperty: #dragOffset toValue: aPoint! !

!TaskMorph class methodsFor: 'instance creation'!
demo
	"Create and show a TaskMorph"
	^ self new openInWorld! !