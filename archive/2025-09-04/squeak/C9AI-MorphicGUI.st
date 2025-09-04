SystemWindow subclass: #C9AIAgenticWindow
	instanceVariableNames: 'aiClient promptInput responseText sendButton statusLabel'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Core'!

!C9AIAgenticWindow methodsFor: 'initialization'!
initialize
	super initialize.
	aiClient := C9AILlamaClient new.
	self setupWindow.
	self buildInterface! !

!C9AIAgenticWindow methodsFor: 'initialization'!
setupWindow
	self setLabel: 'C9AI Agentic Tools'.
	self extent: 600@500.
	self center! !

!C9AIAgenticWindow methodsFor: 'interface'!
buildInterface
	| mainPanel |
	mainPanel := self buildMainPanel.
	self addMorph: mainPanel frame: (0@0 corner: 1@1)! !

!C9AIAgenticWindow methodsFor: 'interface'!
buildMainPanel
	| panel header input buttons output |
	panel := Morph new
		color: Color white;
		layoutPolicy: TableLayout new;
		listDirection: #topToBottom;
		hResizing: #spaceFill;
		vResizing: #spaceFill.
	
	header := self buildHeader.
	input := self buildInputArea.
	buttons := self buildButtonArea.
	output := self buildOutputArea.
	
	panel addMorphBack: header.
	panel addMorphBack: input.
	panel addMorphBack: buttons.
	panel addMorphBack: output.
	
	^ panel! !

!C9AIAgenticWindow methodsFor: 'interface'!
buildHeader
	| panel title status |
	panel := Morph new
		color: (Color r: 0.1 g: 0.2 b: 0.4);
		height: 50;
		hResizing: #spaceFill;
		vResizing: #rigid.
	
	title := StringMorph new
		contents: 'C9AI Agentic Tools - Local AI Interface';
		color: Color white.
	
	statusLabel := StringMorph new
		contents: 'Ready';
		color: Color green.
	
	panel addMorph: title.
	panel addMorph: statusLabel.
	^ panel! !

!C9AIAgenticWindow methodsFor: 'interface'!
buildInputArea
	| panel label |
	panel := Morph new
		color: Color veryLightGray;
		height: 80;
		hResizing: #spaceFill;
		vResizing: #rigid.
	
	label := StringMorph new
		contents: 'Enter your task or question:';
		color: Color black.
	
	promptInput := PluggableTextMorph new
		height: 50;
		hResizing: #spaceFill;
		vResizing: #rigid.
	
	panel addMorph: label.
	panel addMorph: promptInput.
	^ panel! !

!C9AIAgenticWindow methodsFor: 'interface'!
buildButtonArea
	| panel |
	panel := Morph new
		color: Color lightGray;
		height: 40;
		hResizing: #spaceFill;
		vResizing: #rigid.
	
	sendButton := SimpleButtonMorph new
		label: 'Send to AI';
		target: self;
		actionSelector: #sendToAI;
		color: Color green.
	
	panel addMorph: sendButton.
	^ panel! !

!C9AIAgenticWindow methodsFor: 'interface'!
buildOutputArea
	| panel label |
	panel := Morph new
		color: Color white;
		hResizing: #spaceFill;
		vResizing: #spaceFill.
	
	label := StringMorph new
		contents: 'AI Response:';
		color: Color black.
	
	responseText := PluggableTextMorph new
		hResizing: #spaceFill;
		vResizing: #spaceFill.
	
	panel addMorph: label.
	panel addMorph: responseText.
	^ panel! !

!C9AIAgenticWindow methodsFor: 'actions'!
sendToAI
	"Send the prompt to AI and display response"
	| prompt response |
	prompt := promptInput text asString.
	prompt isEmpty ifTrue: [^ self].
	
	self updateStatus: 'Sending to AI...'.
	
	response := aiClient completion: prompt.
	self displayResponse: response.
	self updateStatus: 'Ready'! !

!C9AIAgenticWindow methodsFor: 'actions'!
updateStatus: statusText
	statusLabel contents: statusText! !

!C9AIAgenticWindow methodsFor: 'actions'!
displayResponse: responseText
	responseText 
		ifNotNil: [responseText setText: responseText asString]
		ifNil: [responseText setText: 'No response received']! !

!C9AIAgenticWindow class methodsFor: 'instance creation'!
open
	"Open the C9AI Agentic Window"
	^ self new openInWorld! !