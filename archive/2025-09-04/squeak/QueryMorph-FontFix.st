Morph subclass: #QueryMorph
	instanceVariableNames: 'titleMorph inputMorph sendButton aiClient'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!QueryMorph commentStamp: 'C9AI 8/24/2025 11:30' prior: 0!
A floating query input morph for sending prompts to AI.
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
	self extent: 350@120.
	self layoutPolicy: TableLayout new.
	self listDirection: #topToBottom.
	self cellPositioning: #center.
	self hResizing: #rigid.
	self vResizing: #rigid! !

!QueryMorph methodsFor: 'interface'!
buildInterface
	self removeAllMorphs.
	
	titleMorph := self buildTitle.
	inputMorph := self buildInput.
	sendButton := self buildSendButton.
	
	self addMorphBack: titleMorph.
	self addMorphBack: inputMorph.
	self addMorphBack: sendButton! !

!QueryMorph methodsFor: 'interface'!
buildTitle
	| title |
	title := StringMorph new
		contents: 'AI Query';
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
		label: 'Send to AI';
		target: self;
		actionSelector: #sendQuery;
		color: (Color r: 0.3 g: 0.6 b: 0.3);
		extent: 120@25.
	^ button! !

!QueryMorph methodsFor: 'actions'!
sendQuery
	"Send the query to AI and handle response"
	| queryText response |
	queryText := inputMorph text asString.
	queryText isEmpty ifTrue: [^ self showMessage: 'Enter a query first'].
	
	self showMessage: 'Sending...'.
	sendButton color: Color orange.
	
	[response := aiClient completion: queryText.
	 self handleResponse: response queryText: queryText.
	 sendButton color: (Color r: 0.3 g: 0.6 b: 0.3)]
		fork! !

!QueryMorph methodsFor: 'actions'!
handleResponse: responseText queryText: originalQuery
	"Handle the AI response - create a ResponseMorph or show in transcript"
	Transcript show: '=== AI Query ==='; cr.
	Transcript show: 'Q: ', originalQuery; cr.
	Transcript show: 'A: ', responseText; cr.
	Transcript show: '================'; cr.
	
	self showMessage: 'Response ready'! !

!QueryMorph methodsFor: 'feedback'!
showMessage: messageText
	"Show a temporary message in the title"
	| originalContents |
	originalContents := titleMorph contents.
	titleMorph contents: messageText.
	titleMorph color: Color blue.
	
	"Reset after 2 seconds"
	[(Delay forSeconds: 2) wait.
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
	"Create and show a QueryMorph"
	^ self new openInWorld! !