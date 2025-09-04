Morph subclass: #ResponseMorph
	instanceVariableNames: 'titleMorph contentMorph scrollPane conversationHistory saveButton'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!ResponseMorph commentStamp: 'C9AI 8/24/2025 11:45' prior: 0!
A floating response display morph for showing AI responses.
Can be placed anywhere in the Squeak world and displays query-response pairs.

Usage:
  ResponseMorph new openInWorld.
  ResponseMorph showResponse: 'Hello AI' answer: 'Hello, How can I help?'.!

!ResponseMorph methodsFor: 'initialization'!
initialize
	super initialize.
	conversationHistory := OrderedCollection new.
	self setupAppearance.
	self buildInterface.
	self enableDragging! !

!ResponseMorph methodsFor: 'initialization'!
setupAppearance
	self color: (Color r: 0.98 g: 0.98 b: 0.95).
	self borderWidth: 2.
	self borderColor: (Color r: 0.4 g: 0.6 b: 0.3).
	self extent: 400@340.
	self layoutPolicy: TableLayout new.
	self listDirection: #topToBottom.
	self cellPositioning: #topLeft.
	self hResizing: #rigid.
	self vResizing: #rigid.
	self layoutInset: 8! !

!ResponseMorph methodsFor: 'interface'!
buildInterface
	self removeAllMorphs.
	
	titleMorph := self buildTitle.
	scrollPane := self buildScrollPane.
	saveButton := self buildSaveButton.
	
	self addMorphBack: titleMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: scrollPane.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: saveButton! !

!ResponseMorph methodsFor: 'interface'!
buildTitle
	| title |
	title := StringMorph new
		contents: 'AI Response';
		color: (Color r: 0.3 g: 0.5 b: 0.2).
	^ title! !

!ResponseMorph methodsFor: 'interface'!
buildScrollPane
	| pane |
	pane := ScrollPane new
		extent: 360@250;
		color: Color white;
		borderWidth: 1;
		borderColor: Color gray.
	
	contentMorph := self buildContentMorph.
	pane scroller addMorph: contentMorph.
	^ pane! !

!ResponseMorph methodsFor: 'interface'!
buildContentMorph
	| content |
	content := PluggableTextMorph new
		extent: 340@200;
		setText: self formatContent;
		color: Color white;
		borderWidth: 0;
		readOnly: true;
		wrapFlag: true;
		hResizing: #spaceFill;
		vResizing: #shrinkWrap.
	^ content! !

!ResponseMorph methodsFor: 'interface'!
buildSaveButton
	| button |
	button := SimpleButtonMorph new
		label: 'Save Conversation';
		target: self;
		actionSelector: #saveConversation;
		color: (Color r: 0.2 g: 0.4 b: 0.6);
		extent: 140@25.
	^ button! !

!ResponseMorph methodsFor: 'interface'!
buildSpacer: height
	"Create a transparent spacer morph"
	^ Morph new
		color: Color transparent;
		extent: 1@height;
		hResizing: #rigid;
		vResizing: #rigid! !

!ResponseMorph methodsFor: 'content'!
formatContent
	"Format all conversations for display"
	| formatted |
	conversationHistory isEmpty ifTrue: [^ 'No conversation yet. Use QueryMorph to send a question.'].
	
	formatted := String new.
	conversationHistory doWithIndex: [:conversation :index |
		formatted := formatted, 
			'--- Conversation ', index printString, ' ---', String cr,
			'Q: ', (conversation at: #query), String cr,
			'A: ', (conversation at: #response), String cr, String cr].
	^ formatted! !

!ResponseMorph methodsFor: 'content'!
showResponse: aQueryText answer: aResponseText
	"Add a new query-response pair to conversation history"
	conversationHistory add: (Dictionary new
		at: #query put: aQueryText;
		at: #response put: (self translateNewlines: aResponseText);
		yourself).
	self updateDisplay.
	self showMessage: 'Conversation #', conversationHistory size printString! !

!ResponseMorph methodsFor: 'content'!
translateNewlines: text
	"Convert \n and other escape sequences to proper carriage returns"
	| result |
	result := text.
	result := result copyReplaceAll: '\n' with: String cr.
	result := result copyReplaceAll: '\\n' with: String cr.
	^ result! !

!ResponseMorph methodsFor: 'content'!
formatConversationForFile
	"Format conversation history for file export"
	| content timestamp separator separator2 |
	timestamp := DateAndTime now.
	separator := String new: 50 withAll: $=.
	separator2 := String new: 30 withAll: $-.
	
	content := '=== AI Conversation Export ===', String cr,
		'Generated: ', timestamp asString, String cr,
		'Total Conversations: ', conversationHistory size printString, String cr,
		separator, String cr, String cr.
	
	conversationHistory doWithIndex: [:conversation :index |
		content := content, 
			'CONVERSATION #', index printString, String cr,
			separator2, String cr,
			'QUERY: ', (conversation at: #query), String cr, String cr,
			'RESPONSE: ', (conversation at: #response), String cr, String cr,
			separator, String cr, String cr].
	
	^ content! !

!ResponseMorph methodsFor: 'content'!
updateDisplay
	"Refresh the content display"
	contentMorph setText: self formatContent.
	contentMorph changed.
	
	"Let the scrollPane handle its own updates"
	scrollPane changed! !

!ResponseMorph methodsFor: 'actions'!
saveConversation
	"Save the conversation history to a text file"
	| filename content timestamp file |
	
	conversationHistory isEmpty ifTrue: [
		^ self showMessage: 'No conversation to save'
	].
	
	"Create filename with timestamp"
	timestamp := DateAndTime now asString copyReplaceAll: ':' with: '-'.
	filename := 'AI-Conversation-', timestamp, '.txt'.
	
	"Format content for file"
	content := self formatConversationForFile.
	
	"Save to file in current directory"
	[file := FileStream newFileNamed: filename.
	 file nextPutAll: content.
	 file close.
	 self showMessage: 'Saved: ', filename]
		on: Error
		do: [:ex | self showMessage: 'Save failed: ', ex messageText]! !

!ResponseMorph methodsFor: 'feedback'!
showMessage: messageText
	"Show a temporary message in the title"
	| originalContents |
	originalContents := titleMorph contents.
	titleMorph contents: messageText.
	titleMorph color: Color blue.
	
	"Reset after 2 seconds"
	[(Delay forSeconds: 2) wait.
	 titleMorph contents: originalContents.
	 titleMorph color: (Color r: 0.3 g: 0.5 b: 0.2)]
		fork! !

!ResponseMorph methodsFor: 'interaction'!
enableDragging
	"Make the morph draggable"
	self on: #mouseDown send: #startDrag: to: self.
	self on: #mouseMove send: #drag: to: self.
	self on: #mouseUp send: #endDrag: to: self! !

!ResponseMorph methodsFor: 'interaction'!
startDrag: event
	"Start dragging the morph"
	self isDragging: true.
	self dragOffset: event position - self position! !

!ResponseMorph methodsFor: 'interaction'!
drag: event
	"Drag the morph around"
	self isDragging ifTrue: [
		self position: event position - self dragOffset
	]! !

!ResponseMorph methodsFor: 'interaction'!
endDrag: event
	"End dragging"
	self isDragging: false! !

!ResponseMorph methodsFor: 'accessing'!
isDragging
	"Check if currently being dragged"
	^ self valueOfProperty: #isDragging ifAbsent: [false]! !

!ResponseMorph methodsFor: 'accessing'!
isDragging: aBoolean
	"Set dragging state"
	self setProperty: #isDragging toValue: aBoolean! !

!ResponseMorph methodsFor: 'accessing'!
dragOffset
	"Get drag offset"
	^ self valueOfProperty: #dragOffset ifAbsent: [0@0]! !

!ResponseMorph methodsFor: 'accessing'!
dragOffset: aPoint
	"Set drag offset"
	self setProperty: #dragOffset toValue: aPoint! !

!ResponseMorph class methodsFor: 'instance creation'!
demo
	"Create and show a ResponseMorph with sample data"
	| morph |
	morph := self new.
	morph showResponse: 'What is Squeak Smalltalk' 
	      answer: 'Squeak is a modern implementation of Smalltalk that provides a complete development environment with live programming capabilities'.
	^ morph openInWorld! !

!ResponseMorph class methodsFor: 'instance creation'!
showResponse: queryText answer: responseText
	"Create a ResponseMorph and show specific content"
	| morph |
	morph := self new.
	morph showResponse: queryText answer: responseText.
	^ morph openInWorld! !