"C9AI Package for Pharo - Using Pharo-specific APIs
This version uses Pharo's Morphic classes and proper Unicode support."

"=== IntegratedAIMorph - Pharo Compatible Version ==="

Morph subclass: #IntegratedAIMorph
	instanceVariableNames: 'titleMorph queryInput responseDisplay testButton renderButton clearButton statusMorph lastQuery lastResponse'
	classVariableNames: ''
	package: 'C9AI-Morphs'!

!IntegratedAIMorph commentStamp: '<historical>' prior: 0!
C9AI Interface for Pharo with proper Unicode support.
Tests Unicode rendering and browser integration.

Usage: IntegratedAIMorph demo.!

!IntegratedAIMorph methodsFor: 'initialization'!
initialize
	super initialize.
	lastQuery := ''.
	lastResponse := ''.
	self setupAppearance.
	self buildInterface! !

!IntegratedAIMorph methodsFor: 'initialization'!
setupAppearance
	self color: (Color r: 0.98 g: 0.98 b: 1.0).
	self borderWidth: 3.
	self borderColor: (Color r: 0.2 g: 0.4 b: 0.9).
	self extent: 650@450.
	self changeTableLayout.
	self listDirection: #topToBottom.
	self hResizing: #spaceFill.
	self vResizing: #spaceFill.
	self layoutInset: 12! !

!IntegratedAIMorph methodsFor: 'interface'!
buildInterface
	self removeAllMorphs.
	
	titleMorph := self buildTitle.
	statusMorph := self buildStatus.
	queryInput := self buildQueryInput.
	responseDisplay := self buildResponseDisplay.
	
	self addMorph: titleMorph.
	self addMorph: (self buildSpacer: 8).
	self addMorph: statusMorph.
	self addMorph: (self buildSpacer: 8).
	self addMorph: (self buildLabel: 'Enter text (try Kannada: ಕನ್ನಡ ಭಾಷೆ ಬಗ್ಗೆ ಹೇಳಿ):').
	self addMorph: (self buildSpacer: 5).
	self addMorph: queryInput.
	self addMorph: (self buildSpacer: 8).
	self addMorph: self buildButtonRow.
	self addMorph: (self buildSpacer: 8).
	self addMorph: responseDisplay! !

!IntegratedAIMorph methodsFor: 'interface'!
buildTitle
	^ StringMorph new
		contents: 'C9AI - Pharo Unicode Test';
		color: (Color r: 0.2 g: 0.4 b: 0.9);
		yourself! !

!IntegratedAIMorph methodsFor: 'interface'!
buildStatus
	^ StringMorph new
		contents: 'Ready - Test with Kannada: ಕನ್ನಡ ಭಾಷೆ';
		color: (Color r: 0.4 g: 0.4 b: 0.4);
		yourself! !

!IntegratedAIMorph methodsFor: 'interface'!
buildLabel: labelText
	^ StringMorph new
		contents: labelText;
		color: (Color r: 0.3 g: 0.3 b: 0.3);
		yourself! !

!IntegratedAIMorph methodsFor: 'interface'!
buildQueryInput
	^ TextMorph new
		extent: 600@50;
		color: Color white;
		borderWidth: 2;
		borderColor: (Color r: 0.7 g: 0.7 b: 0.7);
		contents: '';
		yourself! !

!IntegratedAIMorph methodsFor: 'interface'!
buildResponseDisplay
	^ TextMorph new
		extent: 600@200;
		contents: 'Enter text above and test. This is Pharo with proper Unicode support.';
		color: (Color r: 0.99 g: 0.99 b: 0.99);
		borderWidth: 2;
		borderColor: (Color r: 0.8 g: 0.8 b: 0.8);
		yourself! !

!IntegratedAIMorph methodsFor: 'interface'!
buildButtonRow
	| container |
	container := Morph new
		color: Color transparent;
		changeTableLayout;
		listDirection: #leftToRight;
		hResizing: #spaceFill;
		vResizing: #shrinkWrap;
		extent: 600@35;
		yourself.
	
	testButton := SimpleButtonMorph new
		label: 'Test Response';
		target: self;
		actionSelector: #testResponse;
		color: (Color r: 0.3 g: 0.9 b: 0.3);
		extent: 120@25;
		yourself.
	
	renderButton := SimpleButtonMorph new
		label: 'Render Better';
		target: self;
		actionSelector: #renderBetter;
		color: (Color r: 0.2 g: 0.7 b: 0.9);
		extent: 120@25;
		yourself.
	
	clearButton := SimpleButtonMorph new
		label: 'Clear';
		target: self;
		actionSelector: #clearAll;
		color: (Color r: 0.7 g: 0.7 b: 0.7);
		extent: 80@25;
		yourself.
	
	container addMorph: testButton.
	container addMorph: (self buildSpacer: 8).
	container addMorph: renderButton.
	container addMorph: (self buildSpacer: 8).
	container addMorph: clearButton.
	
	^ container! !

!IntegratedAIMorph methodsFor: 'interface'!
buildSpacer: height
	^ Morph new
		color: Color transparent;
		extent: 1@height;
		hResizing: #rigid;
		vResizing: #rigid;
		yourself! !

!IntegratedAIMorph methodsFor: 'actions'!
testResponse
	| queryText response |
	queryText := queryInput contents asString.
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
- Unicode points: ', (queryText collect: [:char | char asInteger printString]) joinUsing: ', ', '
- Contains Kannada: ', (self containsKannada: queryText) printString, '

'.
	
	(self containsKannada: queryText) ifTrue: [
		response := response, 'Detected Kannada Script:

Sample Kannada Response:
ಕನ್ನಡ ಭಾಷೆಯು ಸುಂದರವಾದ ಭಾಷೆಯಾಗಿದೆ. 
ಇದು ದ್ರಾವಿಡ ಭಾಷೆಗಳ ಕುಟುಂಬಕ್ಕೆ ಸೇರಿದೆ.
ಕರ್ನಾಟಕ ರಾಜ್ಯದ ಅಧಿಕೃತ ಭಾಷೆಯಾಗಿದೆ.

Note: This should display with proper ligatures in Pharo and in the browser!'
	].
	
	^ response! !

!IntegratedAIMorph methodsFor: 'actions'!
containsKannada: text
	"Check if text contains Kannada characters (U+0C80-U+0CFF)"
	text do: [:char |
		| codePoint |
		codePoint := char asInteger.
		((codePoint >= 3200) and: [codePoint <= 3327]) ifTrue: [^ true]
	].
	^ false! !

!IntegratedAIMorph methodsFor: 'actions'!
renderBetter
	| textToRender |
	textToRender := lastResponse ifEmpty: [queryInput contents asString].
	textToRender isEmpty ifTrue: [
		^ self showStatus: 'No text to render - enter text or generate response first'
	].
	
	self showStatus: 'Opening Unicode renderer...'.
	
	[self openUnicodeRenderer: textToRender.
	 self showStatus: 'Unicode renderer opened - check browser']
		fork! !

!IntegratedAIMorph methodsFor: 'actions'!
openUnicodeRenderer: textContent
	"Open text in browser with proper Unicode rendering - Pharo version"
	| html fileName filePath |
	
	html := self generateHTML: textContent title: 'C9AI Pharo Unicode Test'.
	
	fileName := 'c9ai_pharo_unicode_', DateAndTime now printString copyReplaceAll: ':' with: '_', '.html'.
	filePath := '/tmp/', fileName.
	
	[filePath asFileReference writeStreamDo: [:stream |
		stream nextPutAll: html
	].
	
	"Try different ways to open the file"
	[OSPlatform current shell: 'open "', filePath, '"']
		on: Error
		do: [:ex |
			"Fallback: just show the path"
			Transcript show: 'Generated HTML file: ', filePath; cr.
			Transcript show: 'Open this file manually in your browser'; cr].
	
	Transcript show: 'Unicode renderer: ', filePath; cr]
		on: Error
		do: [:ex |
			Transcript show: 'Renderer error: ', ex messageText; cr.
			self showStatus: 'Renderer error - check Transcript']! !

!IntegratedAIMorph methodsFor: 'html-generation'!
generateHTML: textContent title: titleText
	"Generate HTML with proper Unicode support for Pharo"
	| html |
	
	html := '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>', (self escapeHTML: titleText), '</title>'.
	html := html, '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;700&display=swap" rel="stylesheet">'.
	html := html, '<style>'.
	html := html, 'body{font-family:"Noto Sans Kannada",Arial,sans-serif;margin:20px;padding:20px;background:#f8f9fa;line-height:1.6;}'. 
	html := html, 'h1{background:#667eea;color:white;padding:20px;border-radius:10px;text-align:center;margin-bottom:20px;}'.
	html := html, 'pre{background:white;padding:30px;border-radius:10px;white-space:pre-wrap;font-size:18px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}'.
	html := html, '.kannada{font-weight:400;letter-spacing:0.5px;text-rendering:optimizeLegibility;}'.
	html := html, '</style></head><body>'.
	html := html, '<h1>', (self escapeHTML: titleText), '</h1>'.
	html := html, '<pre class="kannada">', (self escapeHTML: textContent), '</pre>'.
	html := html, '<p><small>Generated from Pharo Smalltalk with Unicode support</small></p>'.
	html := html, '</body></html>'.
	
	^ html! !

!IntegratedAIMorph methodsFor: 'html-generation'!
escapeHTML: text
	"Escape HTML special characters"
	| result |
	result := text copyReplaceAll: '&' with: '&amp;'.
	result := result copyReplaceAll: '<' with: '&lt;'.
	result := result copyReplaceAll: '>' with: '&gt;'.
	result := result copyReplaceAll: '"' with: '&quot;'.
	^ result! !

!IntegratedAIMorph methodsFor: 'actions'!
clearAll
	queryInput contents: ''.
	responseDisplay contents: 'Enter text above and test.'.
	lastQuery := ''.
	lastResponse := ''.
	self showStatus: 'Cleared'! !

!IntegratedAIMorph methodsFor: 'feedback'!
showResponse: responseText
	responseDisplay contents: responseText! !

!IntegratedAIMorph methodsFor: 'feedback'!
showStatus: messageText
	statusMorph contents: messageText.
	statusMorph color: Color blue.
	
	[(Delay forSeconds: 3) wait.
	 statusMorph contents: 'Ready - Test with Kannada: ಕನ್ನಡ ಭಾಷೆ'.
	 statusMorph color: (Color r: 0.4 g: 0.4 b: 0.4)]
		fork! !

!IntegratedAIMorph class methodsFor: 'instance creation'!
demo
	"Create and show the Pharo Unicode test interface"
	^ self new openInWorld! !

!IntegratedAIMorph class methodsFor: 'testing'!
testKannadaInput
	"Quick test with pre-filled Kannada text"
	| morph |
	morph := self new.
	morph openInWorld.
	morph queryInput contents: 'ಕನ್ನಡ ಭಾಷೆ ಬಗ್ಗೆ ಹೇಳಿ - ಇದು ಸುಂದರ ಭಾಷೆ'.
	^ morph! !

!IntegratedAIMorph class methodsFor: 'testing'!
unicodeTest
	"Test Unicode handling directly"
	| testText |
	testText := 'ಕನ್ನಡ ಭಾಷೆ'.
	Transcript show: 'Original: ', testText; cr.
	Transcript show: 'Size: ', testText size printString; cr.
	Transcript show: 'Unicode points: ', (testText collect: [:char | char asInteger printString]) joinUsing: ', '; cr.
	^ testText! !