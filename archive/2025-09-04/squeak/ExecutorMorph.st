Morph subclass: #ExecutorMorph
	instanceVariableNames: 'titleMorph inputMorph executeButton resultMorph executionHistory'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!ExecutorMorph commentStamp: 'C9AI 8/24/2025 16:30' prior: 0!
ExecutorMorph executes Smalltalk code and returns precise computational results.
Designed to work with TaskMorph-generated code for accurate calculations.

Usage:
  ExecutorMorph new openInWorld.
  ExecutorMorph executeCode: '10 factorial'.!

!ExecutorMorph methodsFor: 'initialization'!
initialize
	super initialize.
	executionHistory := OrderedCollection new.
	self setupAppearance.
	self buildInterface.
	self enableDragging! !

!ExecutorMorph methodsFor: 'initialization'!
setupAppearance
	self color: (Color r: 0.98 g: 0.95 b: 0.98).
	self borderWidth: 2.
	self borderColor: (Color r: 0.6 g: 0.3 b: 0.3).
	self extent: 300@250.
	self layoutPolicy: TableLayout new.
	self listDirection: #topToBottom.
	self cellPositioning: #center.
	self hResizing: #rigid.
	self vResizing: #rigid.
	self layoutInset: 8! !

!ExecutorMorph methodsFor: 'interface'!
buildInterface
	self removeAllMorphs.
	
	titleMorph := self buildTitle.
	inputMorph := self buildInput.
	executeButton := self buildExecuteButton.
	resultMorph := self buildResult.
	
	self addMorphBack: titleMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: inputMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: executeButton.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: resultMorph! !

!ExecutorMorph methodsFor: 'interface'!
buildTitle
	| title |
	title := StringMorph new
		contents: 'Code Executor';
		color: (Color r: 0.5 g: 0.2 b: 0.2).
	^ title! !

!ExecutorMorph methodsFor: 'interface'!
buildInput
	| input |
	input := PluggableTextMorph new
		extent: 260@40;
		color: Color white;
		borderWidth: 1;
		borderColor: Color gray.
	^ input! !

!ExecutorMorph methodsFor: 'interface'!
buildExecuteButton
	| button |
	button := SimpleButtonMorph new
		label: 'Execute Code';
		target: self;
		actionSelector: #executeCode;
		color: (Color r: 0.6 g: 0.3 b: 0.3);
		extent: 120@25.
	^ button! !

!ExecutorMorph methodsFor: 'interface'!
buildResult
	| result |
	result := PluggableTextMorph new
		extent: 260@100;
		setText: 'Ready to execute Smalltalk code';
		color: (Color r: 0.99 g: 0.99 b: 0.99);
		borderWidth: 1;
		borderColor: Color gray;
		readOnly: true;
		wrapFlag: true.
	^ result! !

!ExecutorMorph methodsFor: 'interface'!
buildSpacer: height
	"Create a transparent spacer morph"
	^ Morph new
		color: Color transparent;
		extent: 1@height;
		hResizing: #rigid;
		vResizing: #rigid! !

!ExecutorMorph methodsFor: 'execution'!
executeCode
	"Execute the Smalltalk code in the input field"
	| codeText result |
	codeText := inputMorph text asString.
	codeText isEmpty ifTrue: [
		^ self showResult: 'Enter Smalltalk code to execute'].
	
	self showMessage: 'Executing...'.
	executeButton color: Color orange.
	
	[result := self safeExecute: codeText.
	 self showResult: result.
	 self logExecution: codeText result: result.
	 executeButton color: (Color r: 0.6 g: 0.3 b: 0.3)]
		fork! !

!ExecutorMorph methodsFor: 'execution'!
safeExecute: codeString
	"Safely execute Smalltalk code and return result"
	| result |
	
	[result := Compiler evaluate: codeString.
	 ^ 'Result: ', result printString]
		on: Error
		do: [:ex | 
			^ 'Error: ', ex messageText]! !

!ExecutorMorph methodsFor: 'execution'!
executeCodeDirectly: codeString
	"Execute code directly and return result string"
	| result |
	
	[result := Compiler evaluate: codeString.
	 self logExecution: codeString result: result printString.
	 ^ result printString]
		on: Error
		do: [:ex | 
			self logExecution: codeString result: ('Error: ', ex messageText).
			^ 'Error: ', ex messageText]! !

!ExecutorMorph methodsFor: 'execution'!
logExecution: codeText result: resultText
	"Log the execution to history"
	executionHistory add: (Dictionary new
		at: #code put: codeText;
		at: #result put: resultText;
		at: #timestamp put: DateAndTime now;
		yourself).
	
	"Show in Transcript"
	Transcript show: '=== Code Execution ==='; cr.
	Transcript show: 'Code: ', codeText; cr.
	Transcript show: 'Result: ', resultText; cr.
	Transcript show: '==================='; cr! !

!ExecutorMorph methodsFor: 'feedback'!
showResult: resultText
	"Display execution result"
	resultMorph setText: resultText.
	resultMorph changed! !

!ExecutorMorph methodsFor: 'feedback'!
showMessage: messageText
	"Show a temporary message in the title"
	| originalContents |
	originalContents := titleMorph contents.
	titleMorph contents: messageText.
	titleMorph color: Color blue.
	
	"Reset after 2 seconds"
	[(Delay forSeconds: 2) wait.
	 titleMorph contents: originalContents.
	 titleMorph color: (Color r: 0.5 g: 0.2 b: 0.2)]
		fork! !

!ExecutorMorph methodsFor: 'interaction'!
enableDragging
	"Make the morph draggable"
	self on: #mouseDown send: #startDrag: to: self.
	self on: #mouseMove send: #drag: to: self.
	self on: #mouseUp send: #endDrag: to: self! !

!ExecutorMorph methodsFor: 'interaction'!
startDrag: event
	"Start dragging the morph"
	self isDragging: true.
	self dragOffset: event position - self position! !

!ExecutorMorph methodsFor: 'interaction'!
drag: event
	"Drag the morph around"
	self isDragging ifTrue: [
		self position: event position - self dragOffset
	]! !

!ExecutorMorph methodsFor: 'interaction'!
endDrag: event
	"End dragging"
	self isDragging: false! !

!ExecutorMorph methodsFor: 'accessing'!
isDragging
	"Check if currently being dragged"
	^ self valueOfProperty: #isDragging ifAbsent: [false]! !

!ExecutorMorph methodsFor: 'accessing'!
isDragging: aBoolean
	"Set dragging state"
	self setProperty: #isDragging toValue: aBoolean! !

!ExecutorMorph methodsFor: 'accessing'!
dragOffset
	"Get drag offset"
	^ self valueOfProperty: #dragOffset ifAbsent: [0@0]! !

!ExecutorMorph methodsFor: 'accessing'!
dragOffset: aPoint
	"Set drag offset"
	self setProperty: #dragOffset toValue: aPoint! !

!ExecutorMorph methodsFor: 'accessing'!
setInputText: codeString
	"Set the input text programmatically"
	inputMorph setText: codeString! !

!ExecutorMorph class methodsFor: 'instance creation'!
demo
	"Create and show an ExecutorMorph"
	^ self new openInWorld! !

!ExecutorMorph class methodsFor: 'instance creation'!
executeCode: codeString
	"Create ExecutorMorph and execute specific code"
	| morph |
	morph := self new.
	morph openInWorld.
	morph setInputText: codeString.
	morph executeCode.
	^ morph! !