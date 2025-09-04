"C9AI Package Export for Pharo Migration
This file contains all the working C9AI classes for testing in Pharo.
File this into Pharo to test Unicode support."

"=== IntegratedAIMorph - Main Interface ==="

Morph subclass: #IntegratedAIMorph
	instanceVariableNames: 'titleMorph queryInput responseDisplay localAIButton clearButton statusMorph lastQuery lastResponse renderButton'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!IntegratedAIMorph commentStamp: 'C9AI 8/25/2025 08:10' prior: 0!
Working IntegratedAIMorph with Unicode renderer capability.
Designed for Pharo with proper Unicode support.

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
		contents: 'C9AI - Unicode Test (Pharo Version)';
		color: (Color r: 0.2 g: 0.4 b: 0.9)! !

!IntegratedAIMorph methodsFor: 'interface'!
buildStatus
	^ StringMorph new
		contents: 'Ready - Test with Kannada: ಕನ್ನಡ ಭಾಷೆ';
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
		contents: 'Enter text (try Kannada: ಕನ್ನಡ ಭಾಷೆ ಬಗ್ಗೆ ಹೇಳಿ):';
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
		label: 'Test Response';
		target: self;
		actionSelector: #testResponse;
		color: (Color r: 0.3 g: 0.9 b: 0.3);
		extent: 120@25.
	
	renderButton := SimpleButtonMorph new
		label: 'Render Better';
		target: self;
		actionSelector: #renderBetter;
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
		setText: 'Enter text above and test. This is the Pharo version with proper Unicode support.';
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
	self showStatus: 'Response generated - try Render Better for Unicode'! !

!IntegratedAIMorph methodsFor: 'actions'!
generateTestResponse: queryText
	| response |
	response := 'PHARO UNICODE TEST
==================

Input: ', queryText, '

Analysis:
- Length: ', queryText size printString, ' characters
- Contains Kannada: ', (self containsKannada: queryText) printString, '.

'.
	
	(self containsKannada: queryText) ifTrue: [
		response := response, 'Sample Kannada Response:
ಕನ್ನಡ ಭಾಷೆಯು ಸುಂದರವಾದ ಭಾಷೆಯಾಗಿದೆ. ಇದು ದ್ರಾವಿಡ ಭಾಷೆಗಳ ಕುಟುಂಬಕ್ಕೆ ಸೇರಿದೆ.

Note: This should display properly in Pharo with correct ligatures.'
	].
	
	^ response! !

!IntegratedAIMorph methodsFor: 'actions'!
containsKannada: text
	text do: [:char |
		| codePoint |
		codePoint := char asInteger.
		((codePoint >= 3200) and: [codePoint <= 3327]) ifTrue: [^ true]
	].
	^ false! !

!IntegratedAIMorph methodsFor: 'actions'!
renderBetter
	| textToRender |
	textToRender := lastResponse ifEmpty: [queryInput text asString].
	textToRender isEmpty ifTrue: [
		^ self showStatus: 'No text to render - enter text or generate response first'
	].
	
	self showStatus: 'Opening Unicode renderer...'.
	
	[self openUnicodeRenderer: textToRender.
	 self showStatus: 'Unicode renderer opened - check browser']
		fork! !

!IntegratedAIMorph methodsFor: 'actions'!
openUnicodeRenderer: textContent
	| html fileName filePath |
	
	html := self generateHTML: textContent title: 'C9AI Unicode Test (Pharo)'.
	
	fileName := 'c9ai_pharo_unicode_', DateAndTime now asString copyReplaceAll: ':' with: '_', '.html'.
	filePath := '/tmp/', fileName.
	
	[filePath asFileReference writeStreamDo: [:stream |
		stream nextPutAll: html.
	].
	
	OSProcess command: 'open "', filePath, '"'.
	
	Transcript show: 'Unicode renderer opened: ', filePath; cr]
		on: Error
		do: [:ex |
			Transcript show: 'Renderer error: ', ex messageText; cr.
			self showStatus: 'Renderer error - check Transcript']! !

!IntegratedAIMorph methodsFor: 'html-generation'!
generateHTML: textContent title: titleText
	| html bang |
	bang := Character value: 33.
	
	html := '<', bang asString, 'DOCTYPE html><html><head><meta charset="UTF-8"><title>', (self escapeHTML: titleText), '</title>'.
	html := html, '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;700&display=swap" rel="stylesheet">'.
	html := html, '<style>body{font-family:"Noto Sans Kannada",Arial,sans-serif;margin:20px;padding:20px;background:#f8f9fa;}'. 
	html := html, 'h1{background:#667eea;color:white;padding:20px;border-radius:10px;text-align:center;}'.
	html := html, 'pre{background:white;padding:30px;border-radius:10px;white-space:pre-wrap;font-size:18px;}'.
	html := html, '</style></head><body>'.
	html := html, '<h1>', (self escapeHTML: titleText), '</h1>'.
	html := html, '<pre>', (self escapeHTML: textContent), '</pre></body></html>'.
	
	^ html! !

!IntegratedAIMorph methodsFor: 'html-generation'!
escapeHTML: text
	| result |
	result := text copyReplaceAll: '&' with: '&amp;'.
	result := result copyReplaceAll: '<' with: '&lt;'.
	result := result copyReplaceAll: '>' with: '&gt;'.
	result := result copyReplaceAll: '"' with: '&quot;'.
	^ result! !

!IntegratedAIMorph methodsFor: 'actions'!
clearAll
	queryInput setText: ''.
	responseDisplay setText: 'Enter text above and test.'.
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
	
	[(Delay forSeconds: 3) wait.
	 statusMorph contents: 'Ready - Test with Kannada: ಕನ್ನಡ ಭಾಷೆ'.
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
	^ self new openInWorld! !

!IntegratedAIMorph class methodsFor: 'testing'!
testKannada
	| morph |
	morph := self new.
	morph openInWorld.
	morph queryInput setText: 'ಕನ್ನಡ ಭಾಷೆ ಬಗ್ಗೆ ಹೇಳಿ'.
	^ morph! !