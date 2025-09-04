Morph subclass: #ResponseMorph
	instanceVariableNames: 'titleMorph conversationColumn scrollPane conversationHistory saveButton'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!ResponseMorph commentStamp: 'C9AI 8/24/2025 16:45' prior: 0!
A floating response display morph with individual conversation morphs.
Each conversation is a separate morph with its own verification buttons.
Can be placed anywhere in the Squeak world and displays query-response pairs.

Usage:
  ResponseMorph new openInWorld.!

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
	self extent: 450@400.
	self layoutPolicy: TableLayout new.
	self listDirection: #topToBottom.
	self cellPositioning: #topLeft.
	self hResizing: #spaceFill.
	self vResizing: #spaceFill.
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
		contents: 'AI Conversations';
		color: (Color r: 0.3 g: 0.5 b: 0.2).
	^ title! !

!ResponseMorph methodsFor: 'interface'!
buildScrollPane
	| pane |
	pane := ScrollPane new
		extent: 410@320;
		color: Color white;
		borderWidth: 1;
		borderColor: Color gray;
		hResizing: #spaceFill;
		vResizing: #spaceFill.
	
	conversationColumn := self buildConversationColumn.
	pane scroller addMorph: conversationColumn.
	scrollPane := pane.
	^ pane! !

!ResponseMorph methodsFor: 'interface'!
buildConversationColumn
	| column |
	column := Morph new
		color: Color transparent;
		layoutPolicy: TableLayout new;
		listDirection: #topToBottom;
		cellPositioning: #topLeft;
		hResizing: #spaceFill;
		vResizing: #shrinkWrap;
		extent: 380@100.
	^ column! !

!ResponseMorph methodsFor: 'interface'!
buildSaveButton
	| button |
	button := SimpleButtonMorph new
		label: 'Save All Conversations';
		target: self;
		actionSelector: #saveConversation;
		color: (Color r: 0.2 g: 0.4 b: 0.6);
		extent: 160@25.
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
showResponse: aQueryText answer: aResponseText
	"Add a new conversation as an individual morph"
	| conversationMorph conversationNumber |
	
	"Store in history"
	conversationHistory add: (Dictionary new
		at: #query put: aQueryText;
		at: #response put: (self translateNewlines: aResponseText);
		yourself).
	
	"Create individual conversation morph"
	conversationNumber := conversationHistory size.
	conversationMorph := self createConversationMorph: aQueryText 
	                                             answer: aResponseText
	                                             number: conversationNumber.
	
	"Add to column"
	conversationColumn addMorphBack: conversationMorph.
	conversationColumn addMorphBack: (self buildSpacer: 10).
	
	"Update display"
	scrollPane changed.
	self showMessage: 'Conversation #', conversationNumber printString! !

!ResponseMorph methodsFor: 'content'!
createConversationMorph: queryText answer: responseText number: number
	"Create an individual conversation morph with verification buttons"
	| container queryMorph responseMorph buttonRow responseHeight |
	
	"Calculate response height based on content length"
	responseHeight := (responseText size / 60) max: 2.
	responseHeight := (responseHeight * 16) min: 120.
	
	container := Morph new
		color: (Color r: 0.99 g: 0.99 b: 0.99);
		borderWidth: 1;
		borderColor: (Color r: 0.8 g: 0.8 b: 0.8);
		layoutPolicy: TableLayout new;
		listDirection: #topToBottom;
		cellPositioning: #topLeft;
		hResizing: #spaceFill;
		vResizing: #shrinkWrap;
		layoutInset: 6.
	
	"Conversation number header"
	container addMorphBack: (StringMorph new
		contents: '--- Conversation ', number printString, ' ---';
		color: (Color r: 0.4 g: 0.4 b: 0.4)).
	container addMorphBack: (self buildSpacer: 4).
	
	"Query section - wrappable text"
	container addMorphBack: (PluggableTextMorph new
		setText: 'Q: ', queryText;
		extent: 320@(queryText size / 50 max: 1 * 16);
		color: (Color r: 0.95 g: 0.95 b: 1.0);
		borderWidth: 0;
		readOnly: true;
		wrapFlag: true;
		hResizing: #spaceFill;
		vResizing: #shrinkWrap).
	container addMorphBack: (self buildSpacer: 4).
	
	"Response section - flexible height"
	responseMorph := PluggableTextMorph new
		setText: 'A: ', responseText;
		extent: 320@responseHeight;
		color: Color white;
		borderWidth: 1;
		borderColor: (Color r: 0.9 g: 0.9 b: 0.9);
		readOnly: true;
		wrapFlag: true;
		hResizing: #spaceFill;
		vResizing: #shrinkWrap.
	container addMorphBack: responseMorph.
	container addMorphBack: (self buildSpacer: 6).
	
	"Verification buttons"
	buttonRow := self createVerificationButtons: queryText answer: responseText.
	container addMorphBack: buttonRow.
	
	^ container! !

!ResponseMorph methodsFor: 'content'!
createVerificationButtons: queryText answer: responseText
	"Create verification button row for this conversation"
	| buttonRow verifyButton cloudButton |
	
	buttonRow := Morph new
		color: Color transparent;
		layoutPolicy: TableLayout new;
		listDirection: #leftToRight;
		cellPositioning: #center;
		hResizing: #spaceFill;
		vResizing: #rigid;
		extent: 320@30.
	
	"Web Search Verification Button"
	verifyButton := SimpleButtonMorph new
		label: 'Verify Facts';
		target: self;
		actionSelector: #verifyFacts:answer:;
		arguments: (Array with: queryText with: responseText);
		color: (Color r: 0.7 g: 0.5 b: 0.2);
		extent: 80@24.
	
	"Cloud AI Check Button"  
	cloudButton := SimpleButtonMorph new
		label: 'Check Cloud AI';
		target: self;
		actionSelector: #checkCloudAI:answer:;
		arguments: (Array with: queryText with: responseText);
		color: (Color r: 0.2 g: 0.5 b: 0.7);
		extent: 100@24.
	
	buttonRow addMorphBack: verifyButton.
	buttonRow addMorphBack: (self buildSpacer: 8).
	buttonRow addMorphBack: cloudButton.
	
	^ buttonRow! !

!ResponseMorph methodsFor: 'content'!
translateNewlines: text
	"Convert \n and other escape sequences to proper carriage returns"
	| result |
	result := text.
	result := result copyReplaceAll: '\n' with: String cr.
	result := result copyReplaceAll: '\\n' with: String cr.
	^ result! !

!ResponseMorph methodsFor: 'verification'!
verifyFacts: queryText answer: responseText
	"Perform web search verification using SearchMorph"
	| searchMorph searchQuery newPosition |
	
	"Extract key terms from the query for searching"
	searchQuery := self extractFactualTerms: queryText.
	
	"Find or create SearchMorph"
	searchMorph := self findOrCreateSearchMorph.
	
	"Set the search query and perform search"
	searchMorph setQueryText: 'Verify: ', searchQuery.
	searchMorph performSearch.
	
	"Show status"
	self showMessage: 'Web search started for verification'! !

!ResponseMorph methodsFor: 'verification'!
checkCloudAI: queryText answer: responseText  
	"Check with cloud AI using CloudAIMorph"
	| cloudMorph |
	
	"Find or create CloudAIMorph"
	cloudMorph := self findOrCreateCloudAIMorph.
	
	"Set the query and perform cloud check"
	cloudMorph setQueryText: queryText.
	cloudMorph performCloudCheck.
	
	"Show status"
	self showMessage: 'Cloud AI cross-check started'! !

!ResponseMorph methodsFor: 'verification'!
showVerificationResult: resultText title: titleText
	"Show verification result in transcript for now"
	Transcript show: '=== ', titleText, ' ==='; cr.
	Transcript show: resultText; cr.
	Transcript show: '========================'; cr.
	
	"TODO: Could create a VerificationMorph instead"! !

!ResponseMorph methodsFor: 'verification'!
findOrCreateSearchMorph
	"Find existing SearchMorph or create one"
	| searchMorph newPosition |
	
	searchMorph := World submorphs detect: [:morph | morph class name = #SearchMorph] ifNone: [nil].
	
	searchMorph ifNil: [
		"Create SearchMorph positioned near this ResponseMorph"
		newPosition := self position + (self width + 20 @ 0).
		searchMorph := (Smalltalk at: #SearchMorph) new.
		searchMorph position: newPosition.
		searchMorph openInWorld].
	
	^ searchMorph! !

!ResponseMorph methodsFor: 'verification'!
findOrCreateCloudAIMorph
	"Find existing CloudAIMorph or create one"
	| cloudMorph newPosition |
	
	cloudMorph := World submorphs detect: [:morph | morph class name = #CloudAIMorph] ifNone: [nil].
	
	cloudMorph ifNil: [
		"Create CloudAIMorph positioned below this ResponseMorph"
		newPosition := self position + (0 @ (self height + 20)).
		cloudMorph := (Smalltalk at: #CloudAIMorph) new.
		cloudMorph position: newPosition.
		cloudMorph openInWorld].
	
	^ cloudMorph! !

!ResponseMorph methodsFor: 'verification'!
extractFactualTerms: queryText
	"Extract key terms from query for web search"
	| cleanQuery |
	
	cleanQuery := queryText.
	
	"Remove common question words"
	cleanQuery := cleanQuery copyReplaceAll: 'what is ' with: ''.
	cleanQuery := cleanQuery copyReplaceAll: 'who is ' with: ''.
	cleanQuery := cleanQuery copyReplaceAll: 'when was ' with: ''.
	cleanQuery := cleanQuery copyReplaceAll: 'where is ' with: ''.
	cleanQuery := cleanQuery copyReplaceAll: 'how does ' with: ''.
	cleanQuery := cleanQuery copyReplaceAll: 'why did ' with: ''.
	cleanQuery := cleanQuery copyReplaceAll: 'who founded ' with: ''.
	cleanQuery := cleanQuery copyReplaceAll: 'who created ' with: ''.
	cleanQuery := cleanQuery copyReplaceAll: 'who invented ' with: ''.
	
	"Remove computational sigils"
	(cleanQuery beginsWith: '= ') ifTrue: [
		cleanQuery := cleanQuery copyFrom: 3 to: cleanQuery size].
	
	^ cleanQuery! !

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