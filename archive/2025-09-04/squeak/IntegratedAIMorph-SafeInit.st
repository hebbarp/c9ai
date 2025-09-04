Morph subclass: #IntegratedAIMorph
	instanceVariableNames: 'titleMorph queryInput responseDisplay localAIButton verifyCloudButton verifyWebButton computeButton clearButton statusMorph scrollPane lastQuery lastResponse childMorphs aiClient renderBetterButton unicodeRenderer'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!IntegratedAIMorph commentStamp: 'C9AI 8/25/2025 12:30' prior: 0!
IntegratedAIMorph combines all C9AI components with Unicode rendering support.
Now includes "Render Better" button for proper Unicode display in browser.

Usage:
  IntegratedAIMorph demo.
  
Features:
- Local AI responses with built-in knowledge
- Unified query interface  
- Cloud AI verification
- Web search verification
- Computational task execution
- Unicode rendering in browser for complex scripts
- Complete morph cleanup
- Status feedback!

!IntegratedAIMorph methodsFor: 'initialization'!
initialize
	super initialize.
	childMorphs := OrderedCollection new.
	lastQuery := ''.
	lastResponse := ''.
	
	"Safe initialization - check if classes exist"
	aiClient := self createAIClient.
	unicodeRenderer := self createUnicodeRenderer.
	
	self setupAppearance.
	self buildInterface.
	self enableDragging! !

!IntegratedAIMorph methodsFor: 'initialization'!
createAIClient
	"Create AI client safely - handle missing class"
	| clientClass |
	
	[clientClass := Smalltalk at: #C9AILlamaClient.
	 clientClass ifNotNil: [^ clientClass new]]
		on: Error do: [:ex | 
			Transcript show: 'C9AILlamaClient not available: ', ex messageText; cr].
	
	"Fallback - return a mock object"
	^ self createMockAIClient! !

!IntegratedAIMorph methodsFor: 'initialization'!
createUnicodeRenderer
	"Create Unicode renderer safely - handle missing class"
	| rendererClass |
	
	[rendererClass := Smalltalk at: #UnicodeRenderer.
	 rendererClass ifNotNil: [^ rendererClass new]]
		on: Error do: [:ex |
			Transcript show: 'UnicodeRenderer not available: ', ex messageText; cr].
	
	"Fallback - return a mock object"  
	^ self createMockRenderer! !

!IntegratedAIMorph methodsFor: 'initialization'!
createMockAIClient
	"Create a mock AI client for testing when real one isn't available"
	^ Object new
		in: [:obj |
			obj class compile: 'completion: text ^ ''Mock AI Response: '', text'.
			obj class compile: 'testHealth ^ true'.
			obj]! !

!IntegratedAIMorph methodsFor: 'initialization'!
createMockRenderer
	"Create a mock renderer for testing when real one isn't available"
	^ Object new
		in: [:obj |
			obj class compile: 'renderResponse: text from: source 
				Transcript show: ''Mock Renderer - Text: '', text; cr.
				^ ''mock-file.html'''.
			obj]! !

!IntegratedAIMorph methodsFor: 'initialization'!
setupAppearance
	self color: (Color r: 0.98 g: 0.98 b: 1.0).
	self borderWidth: 3.
	self borderColor: (Color r: 0.2 g: 0.4 b: 0.9).
	self extent: 650@550.
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
	scrollPane := self buildScrollPane.
	
	self addMorphBack: titleMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: statusMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: queryContainer.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: buttonContainer.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: scrollPane! !

!IntegratedAIMorph methodsFor: 'interface'!
buildTitle
	^ StringMorph new
		contents: 'C9AI - Integrated AI Assistant with Unicode Support';
		color: (Color r: 0.2 g: 0.4 b: 0.9)! !

!IntegratedAIMorph methodsFor: 'interface'!
buildStatus
	^ StringMorph new
		contents: 'Ready - File in UnicodeRenderer.st and C9AILlamaClient classes first';
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
		contents: 'Query (supports Unicode - try Kannada):';
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
	"Build container with all action buttons"
	| container topRow bottomRow |
	container := Morph new
		color: Color transparent;
		layoutPolicy: TableLayout new;
		listDirection: #topToBottom;
		cellPositioning: #center;
		hResizing: #spaceFill;
		vResizing: #shrinkWrap;
		extent: 600@70.
	
	topRow := Morph new
		color: Color transparent;
		layoutPolicy: TableLayout new;
		listDirection: #leftToRight;
		cellPositioning: #center;
		hResizing: #spaceFill;
		vResizing: #shrinkWrap;
		extent: 600@30.
	
	localAIButton := self buildLocalAIButton.
	verifyCloudButton := self buildCloudButton.
	verifyWebButton := self buildWebButton.
	computeButton := self buildComputeButton.
	
	topRow addMorphBack: localAIButton.
	topRow addMorphBack: (self buildSpacer: 8).
	topRow addMorphBack: verifyCloudButton.
	topRow addMorphBack: (self buildSpacer: 8).
	topRow addMorphBack: verifyWebButton.
	topRow addMorphBack: (self buildSpacer: 8).
	topRow addMorphBack: computeButton.
	
	bottomRow := Morph new
		color: Color transparent;
		layoutPolicy: TableLayout new;
		listDirection: #leftToRight;
		cellPositioning: #center;
		hResizing: #spaceFill;
		vResizing: #shrinkWrap;
		extent: 600@30.
	
	renderBetterButton := self buildRenderButton.
	clearButton := self buildClearButton.
	
	bottomRow addMorphBack: renderBetterButton.
	bottomRow addMorphBack: (self buildSpacer: 8).
	bottomRow addMorphBack: clearButton.
	
	container addMorphBack: topRow.
	container addMorphBack: (self buildSpacer: 5).
	container addMorphBack: bottomRow.
	
	^ container! !

!IntegratedAIMorph methodsFor: 'interface'!
buildLocalAIButton
	^ SimpleButtonMorph new
		label: 'Local AI';
		target: self;
		actionSelector: #performLocalAI;
		color: (Color r: 0.3 g: 0.9 b: 0.3);
		extent: 100@25! !

!IntegratedAIMorph methodsFor: 'interface'!
buildCloudButton
	^ SimpleButtonMorph new
		label: 'Cloud Verify';
		target: self;
		actionSelector: #performCloudVerify;
		color: (Color r: 0.9 g: 0.6 b: 0.3);
		extent: 110@25! !

!IntegratedAIMorph methodsFor: 'interface'!
buildWebButton
	^ SimpleButtonMorph new
		label: 'Web Search';
		target: self;
		actionSelector: #performWebSearch;
		color: (Color r: 0.6 g: 0.3 b: 0.9);
		extent: 100@25! !

!IntegratedAIMorph methodsFor: 'interface'!
buildComputeButton
	^ SimpleButtonMorph new
		label: 'Compute';
		target: self;
		actionSelector: #performCompute;
		color: (Color r: 0.9 g: 0.3 b: 0.3);
		extent: 85@25! !

!IntegratedAIMorph methodsFor: 'interface'!
buildRenderButton
	^ SimpleButtonMorph new
		label: 'Render Better';
		target: self;
		actionSelector: #renderBetter;
		color: (Color r: 0.2 g: 0.7 b: 0.9);
		extent: 120@25! !

!IntegratedAIMorph methodsFor: 'interface'!
buildClearButton
	^ SimpleButtonMorph new
		label: 'Clear All';
		target: self;
		actionSelector: #clearAll;
		color: (Color r: 0.7 g: 0.7 b: 0.7);
		extent: 85@25! !

!IntegratedAIMorph methodsFor: 'interface'!
buildScrollPane
	responseDisplay := PluggableTextMorph new
		extent: 600@250;
		setText: 'AI responses will appear here. File in UnicodeRenderer.st and C9AILlamaClient classes for full functionality.';
		color: (Color r: 0.99 g: 0.99 b: 0.99);
		borderWidth: 2;
		borderColor: (Color r: 0.8 g: 0.8 b: 0.8);
		readOnly: true;
		wrapFlag: true.
	
	^ ScrollPane new
		extent: 620@270;
		color: Color white;
		borderWidth: 1;
		borderColor: Color gray;
		scroller: responseDisplay! !

!IntegratedAIMorph methodsFor: 'interface'!
buildSpacer: height
	^ Morph new
		color: Color transparent;
		extent: 1@height;
		hResizing: #rigid;
		vResizing: #rigid! !

!IntegratedAIMorph methodsFor: 'actions'!
performLocalAI
	| queryText response |
	queryText := queryInput text asString.
	queryText isEmpty ifTrue: [
		^ self showStatus: 'Please enter a query first'
	].
	
	self showStatus: 'Querying local AI...'.
	lastQuery := queryText.
	
	[response := aiClient completion: queryText.
	 lastResponse := response.
	 self showResponse: 'LOCAL AI RESPONSE
========================
' , response.
	 self showStatus: 'Local AI query complete']
		fork! !

!IntegratedAIMorph methodsFor: 'actions'!
performCloudVerify
	self showStatus: 'Cloud verification not yet implemented'.
	self showResponse: 'Cloud AI verification coming soon'! !

!IntegratedAIMorph methodsFor: 'actions'!
performWebSearch
	self showStatus: 'Web search not yet implemented'.
	self showResponse: 'Web search functionality coming soon'! !

!IntegratedAIMorph methodsFor: 'actions'!
performCompute
	self showStatus: 'Compute functionality not yet implemented'.
	self showResponse: 'Computational task execution coming soon'! !

!IntegratedAIMorph methodsFor: 'actions'!
renderBetter
	| textToRender |
	textToRender := lastResponse ifEmpty: [queryInput text asString].
	textToRender isEmpty ifTrue: [
		^ self showStatus: 'No text to render - enter text first'
	].
	
	self showStatus: 'Opening Unicode renderer...'.
	
	[unicodeRenderer renderResponse: textToRender from: 'Test'.
	 self showStatus: 'Unicode renderer opened']
		fork! !

!IntegratedAIMorph methodsFor: 'actions'!
clearAll
	queryInput setText: ''.
	responseDisplay setText: 'AI responses will appear here.'.
	lastQuery := ''.
	lastResponse := ''.
	self showStatus: 'All content cleared'! !

!IntegratedAIMorph methodsFor: 'feedback'!
showResponse: responseText
	responseDisplay setText: responseText.
	responseDisplay changed! !

!IntegratedAIMorph methodsFor: 'feedback'!
showStatus: messageText
	statusMorph contents: messageText.
	statusMorph color: Color blue.
	
	[(Delay forSeconds: 3) wait.
	 statusMorph contents: 'Ready - File in required classes for full functionality'.
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
	"Create and show the IntegratedAIMorph with safe initialization"
	^ self new openInWorld! !

!IntegratedAIMorph class methodsFor: 'debug'!
checkDependencies
	"Check if required classes are available"
	| missing |
	missing := OrderedCollection new.
	
	(Smalltalk includesKey: #C9AILlamaClient) ifFalse: [
		missing add: 'C9AILlamaClient'
	].
	
	(Smalltalk includesKey: #UnicodeRenderer) ifFalse: [
		missing add: 'UnicodeRenderer'
	].
	
	missing isEmpty ifTrue: [
		^ 'All dependencies available'
	] ifFalse: [
		^ 'Missing classes: ', (missing joinSeparatedBy: ', ')
	]! !