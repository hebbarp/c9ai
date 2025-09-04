Morph subclass: #IntegratedAIMorph
	instanceVariableNames: 'titleMorph queryInput responseDisplay localAIButton clearButton statusMorph lastQuery lastResponse'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!IntegratedAIMorph commentStamp: 'C9AI 8/25/2025 08:05' prior: 0!
Simple IntegratedAIMorph without complex ScrollPane issues.
Focus on basic functionality first.

Usage:
  IntegratedAIMorph demo.!

!IntegratedAIMorph methodsFor: 'initialization'!
initialize
	super initialize.
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
	self extent: 650@400.
	self layoutPolicy: TableLayout new.
	self listDirection: #topToBottom.
	self cellPositioning: #topLeft.
	self hResizing: #spaceFill.
	self vResizing: #spaceFill.
	self layoutInset: 12! !

!IntegratedAIMorph methodsFor: 'interface'!
buildInterface
	| queryContainer buttonContainer |
	self removeAllMorphs.
	
	titleMorph := self buildTitle.
	statusMorph := self buildStatus.
	queryContainer := self buildQueryContainer.
	buttonContainer := self buildButtonContainer.
	responseDisplay := self buildResponseDisplay.
	
	self addMorphBack: titleMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: statusMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: queryContainer.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: buttonContainer.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: responseDisplay! !

!IntegratedAIMorph methodsFor: 'interface'!
buildTitle
	^ StringMorph new
		contents: 'C9AI - Simple Test Interface';
		color: (Color r: 0.2 g: 0.4 b: 0.9)! !

!IntegratedAIMorph methodsFor: 'interface'!
buildStatus
	^ StringMorph new
		contents: 'Ready - Enter text and test buttons';
		color: (Color r: 0.4 g: 0.4 b: 0.4)! !

!IntegratedAIMorph methodsFor: 'interface'!
buildQueryContainer
	| container label |
	container := Morph new
		color: Color transparent;
		layoutPolicy: TableLayout new;
		listDirection: #topToBottom;
		cellPositioning: #topLeft;
		hResizing: #spaceFill;
		vResizing: #shrinkWrap;
		extent: 600@80.
	
	label := StringMorph new
		contents: 'Enter your query:';
		color: (Color r: 0.3 g: 0.3 b: 0.3).
	
	queryInput := PluggableTextMorph new
		extent: 600@50;
		color: Color white;
		borderWidth: 2;
		borderColor: (Color r: 0.7 g: 0.7 b: 0.7);
		wrapFlag: true.
	
	container addMorphBack: label.
	container addMorphBack: (self buildSpacer: 5).
	container addMorphBack: queryInput.
	
	^ container! !

!IntegratedAIMorph methodsFor: 'interface'!
buildButtonContainer
	| container |
	container := Morph new
		color: Color transparent;
		layoutPolicy: TableLayout new;
		listDirection: #leftToRight;
		cellPositioning: #center;
		hResizing: #spaceFill;
		vResizing: #shrinkWrap;
		extent: 600@35.
	
	localAIButton := SimpleButtonMorph new
		label: 'Test Button';
		target: self;
		actionSelector: #testAction;
		color: (Color r: 0.3 g: 0.9 b: 0.3);
		extent: 120@25.
	
	clearButton := SimpleButtonMorph new
		label: 'Clear';
		target: self;
		actionSelector: #clearAll;
		color: (Color r: 0.7 g: 0.7 b: 0.7);
		extent: 80@25.
	
	container addMorphBack: localAIButton.
	container addMorphBack: (self buildSpacer: 10).
	container addMorphBack: clearButton.
	
	^ container! !

!IntegratedAIMorph methodsFor: 'interface'!
buildResponseDisplay
	"Build simple response display without complex ScrollPane"
	^ PluggableTextMorph new
		extent: 600@150;
		setText: 'Responses will appear here. This is a simplified version to test basic functionality.';
		color: (Color r: 0.99 g: 0.99 b: 0.99);
		borderWidth: 2;
		borderColor: (Color r: 0.8 g: 0.8 b: 0.8);
		readOnly: true;
		wrapFlag: true! !

!IntegratedAIMorph methodsFor: 'interface'!
buildSpacer: height
	^ Morph new
		color: Color transparent;
		extent: 1@height;
		hResizing: #rigid;
		vResizing: #rigid! !

!IntegratedAIMorph methodsFor: 'actions'!
testAction
	| queryText |
	queryText := queryInput text asString.
	queryText isEmpty ifTrue: [
		^ self showStatus: 'Please enter some text first'
	].
	
	self showStatus: 'Processing...'.
	lastQuery := queryText.
	lastResponse := 'Test response for: ', queryText.
	
	self showResponse: 'TEST ACTION RESULT
===================
Input: ', queryText, '
Response: ', lastResponse.
	
	self showStatus: 'Test complete'! !

!IntegratedAIMorph methodsFor: 'actions'!
clearAll
	queryInput setText: ''.
	responseDisplay setText: 'Responses will appear here.'.
	lastQuery := ''.
	lastResponse := ''.
	self showStatus: 'Cleared'! !

!IntegratedAIMorph methodsFor: 'feedback'!
showResponse: responseText
	responseDisplay setText: responseText.
	responseDisplay changed! !

!IntegratedAIMorph methodsFor: 'feedback'!
showStatus: messageText
	statusMorph contents: messageText.
	statusMorph color: Color blue.
	
	[(Delay forSeconds: 2) wait.
	 statusMorph contents: 'Ready - Enter text and test buttons'.
	 statusMorph color: (Color r: 0.4 g: 0.4 b: 0.4)]
		fork! !

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
		self position: event position - self dragOffset
	]! !

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
	"Create and show simple working IntegratedAIMorph"
	^ self new openInWorld! !