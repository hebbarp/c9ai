Morph subclass: #IntegratedAIMorph
	instanceVariableNames: 'titleMorph queryInput responseDisplay localAIButton clearButton statusMorph lastQuery lastResponse renderButton webServer'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!IntegratedAIMorph commentStamp: 'C9AI 8/25/2025 08:10' prior: 0!
Interactive IntegratedAIMorph with bidirectional browser editing.
Browser edits sync back to Squeak interface automatically.

Usage:
  IntegratedAIMorph demo.!

!IntegratedAIMorph methodsFor: 'initialization'!
initialize
	super initialize.
	lastQuery := ''.
	lastResponse := ''.
	webServer := C9AIWebServer new.
	self setupWebServer.
	self setupAppearance.
	self buildInterface.
	self enableDragging! !

!IntegratedAIMorph methodsFor: 'initialization'!
setupWebServer
	"Configure web server for bidirectional communication"
	webServer onContentUpdate: [:newContent |
		"Update the Squeak interface when browser content changes"
		self updateFromBrowser: newContent
	].
	webServer start.
	[webServer startMonitoring] fork! !

!IntegratedAIMorph methodsFor: 'initialization'!
setupAppearance
	self color: (Color r: 0.98 g: 0.98 b: 1.0).
	self borderWidth: 3.
	self borderColor: (Color r: 0.2 g: 0.4 b: 0.9).
	self extent: 650@450.
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
		contents: 'C9AI - Interactive Unicode Editor';
		color: (Color r: 0.2 g: 0.4 b: 0.9)! !

!IntegratedAIMorph methodsFor: 'interface'!
buildStatus
	^ StringMorph new
		contents: 'Ready - Web server running on port 7777';
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
		contents: 'Enter text (syncs with browser):';
		color: (Color r: 0.3 g: 0.3 b: 0.3).
	
	queryInput := PluggableTextMorph new
		extent: 600@50;
		color: Color white;
		borderWidth: 2;
		borderColor: (Color r: 0.7 g: 0.7 b: 0.7);
		wrapFlag: true.
	
	"Monitor for changes and sync to browser"
	queryInput onAnyChange: [self syncToBrowser].
	
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
		label: 'Test Response';
		target: self;
		actionSelector: #testResponse;
		color: (Color r: 0.3 g: 0.9 b: 0.3);
		extent: 120@25.
	
	renderButton := SimpleButtonMorph new
		label: 'Edit in Browser';
		target: self;
		actionSelector: #editInBrowser;
		color: (Color r: 0.2 g: 0.7 b: 0.9);
		extent: 120@25.
	
	clearButton := SimpleButtonMorph new
		label: 'Clear';
		target: self;
		actionSelector: #clearAll;
		color: (Color r: 0.7 g: 0.7 b: 0.7);
		extent: 80@25.
	
	container addMorphBack: localAIButton.
	container addMorphBack: (self buildSpacer: 8).
	container addMorphBack: renderButton.
	container addMorphBack: (self buildSpacer: 8).
	container addMorphBack: clearButton.
	
	^ container! !

!IntegratedAIMorph methodsFor: 'interface'!
buildResponseDisplay
	^ PluggableTextMorph new
		extent: 600@200;
		setText: 'Enter text above and click Test Response or Edit in Browser for live Unicode editing.';
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
testResponse
	| queryText response |
	queryText := queryInput text asString.
	queryText isEmpty ifTrue: [
		^ self showStatus: 'Please enter some text first'
	].
	
	self showStatus: 'Generating test response...'.
	lastQuery := queryText.
	
	response := self generateTestResponse: queryText.
	lastResponse := response.
	
	self showResponse: response.
	self showStatus: 'Response generated - try Edit in Browser for live editing'! !

!IntegratedAIMorph methodsFor: 'actions'!
generateTestResponse: queryText
	"Generate a test response about the input text"
	| response |
	response := 'INTERACTIVE TEST RESPONSE
========================

Input: ', queryText, '

Analysis:
- Length: ', queryText size printString, ' characters
- Contains Kannada: ', (self containsKannada: queryText) printString, '.

'.
	
	"Add Kannada sample if input has Kannada"
	(self containsKannada: queryText) ifTrue: [
		response := response, 'Sample Kannada Response:
ಕನ್ನಡ ಭಾಷೆಯು ಸುಂದರವಾದ ಭಾಷೆಯಾಗಿದೆ. 
ಇದು ದ್ರಾವಿಡ ಭಾಷೆಗಳ ಕುಟುಂಬಕ್ಕೆ ಸೇರಿದೆ.
ಕರ್ನಾಟಕ ರಾಜ್ಯದ ಅಧಿಕೃತ ಭಾಷೆಯಾಗಿದೆ.

Note: Edit this text in the browser - changes sync back to Squeak!'
	].
	
	^ response! !

!IntegratedAIMorph methodsFor: 'actions'!
containsKannada: text
	"Check if text contains Kannada characters"
	text do: [:char |
		| codePoint |
		codePoint := char asInteger.
		"Kannada Unicode range: 0C80–0CFF (3200-3327 decimal)"
		((codePoint >= 3200) and: [codePoint <= 3327]) ifTrue: [^ true]
	].
	^ false! !

!IntegratedAIMorph methodsFor: 'actions'!
editInBrowser
	"Open interactive Unicode editor in browser"
	| textToRender |
	textToRender := lastResponse ifEmpty: [queryInput text asString].
	textToRender isEmpty ifTrue: [
		^ self showStatus: 'No text to edit - enter text or generate response first'
	].
	
	self showStatus: 'Opening interactive Unicode editor...'.
	
	"Send current content to browser"
	webServer sendContentToBrowser: textToRender.
	
	[self callInteractiveRenderer: textToRender title: 'C9AI Interactive Editor'.
	 self showStatus: 'Interactive editor opened - edit in browser, changes sync back']
		fork! !

!IntegratedAIMorph methodsFor: 'actions'!
callInteractiveRenderer: textContent title: titleText
	"Use external script to generate interactive HTML editor"
	| scriptPath outputFile command |
	
	"Build paths"
	scriptPath := '/Users/hebbarp/todo-management/c9ai/scripts/generate-interactive-html.sh'.
	outputFile := '/tmp/c9ai_interactive_', DateAndTime now asString copyReplaceAll: ':' with: '_', '.html'.
	
	"Build command with proper quoting"
	command := scriptPath, ' "', (self escapeForShell: titleText), '" "', (self escapeForShell: textContent), '" "', outputFile, '"'.
	
	"Execute external script"
	[OSProcess command: command.
	 Transcript show: 'Interactive editor opened: ', outputFile; cr]
		on: Error
		do: [:ex |
			Transcript show: 'Interactive editor error: ', ex messageText; cr.
			self showStatus: 'Editor error - check Transcript']! !

!IntegratedAIMorph methodsFor: 'actions'!
escapeForShell: text
	"Escape text for safe shell usage"
	^ text copyReplaceAll: '"' with: '\"'! !

!IntegratedAIMorph methodsFor: 'synchronization'!
syncToBrowser
	"Send current Squeak content to browser"
	| currentText |
	currentText := queryInput text asString.
	webServer sendContentToBrowser: currentText! !

!IntegratedAIMorph methodsFor: 'synchronization'!
updateFromBrowser: newContent
	"Update Squeak interface when browser content changes"
	
	"Update the response display if it was the content being edited"
	lastResponse ~= newContent ifTrue: [
		lastResponse := newContent.
		self showResponse: newContent.
		self showStatus: 'Content updated from browser'
	]! !

!IntegratedAIMorph methodsFor: 'actions'!
clearAll
	queryInput setText: ''.
	responseDisplay setText: 'Enter text above and click buttons to test.'.
	lastQuery := ''.
	lastResponse := ''.
	webServer sendContentToBrowser: ''.
	self showStatus: 'Cleared (browser synced)'! !

!IntegratedAIMorph methodsFor: 'feedback'!
showResponse: responseText
	responseDisplay setText: responseText.
	responseDisplay changed! !

!IntegratedAIMorph methodsFor: 'feedback'!
showStatus: messageText
	statusMorph contents: messageText.
	statusMorph color: Color blue.
	
	[(Delay forSeconds: 3) wait.
	 statusMorph contents: 'Ready - Web server running on port 7777'.
	 statusMorph color: (Color r: 0.4 g: 0.4 b: 0.4)]
		fork! !

!IntegratedAIMorph methodsFor: 'cleanup'!
delete
	"Clean shutdown"
	webServer ifNotNil: [webServer stop].
	super delete! !

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
	"Create and show interactive IntegratedAIMorph with bidirectional browser editing"
	^ self new openInWorld! !