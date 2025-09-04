SystemWindow subclass: #C9AIMainWindow
	instanceVariableNames: 'connector promptField responseArea statusLabel'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-UI'!

!C9AIMainWindow commentStamp: 'C9AI 8/24/2025 08:00' prior: 0!
Main window for C9AI Agentic Tool Interface
Provides Morphic-based GUI for interacting with llama.cpp AI server.!

!C9AIMainWindow methodsFor: 'initialization' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
initialize
	super initialize.
	connector := C9AILlamaConnector new.
	self setupWindow.
	self buildInterface! !

!C9AIMainWindow methodsFor: 'initialization' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
setupWindow
	self label: 'C9AI - Agentic Tools Interface'.
	self model: self.
	self extent: 800@600.
	self center! !

!C9AIMainWindow methodsFor: 'interface' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
buildInterface
	| mainPanel headerPanel inputPanel outputPanel buttonPanel |
	
	"Main container"
	mainPanel := Morph new
		color: Color white;
		layoutPolicy: TableLayout new;
		listDirection: #topToBottom;
		cellPositioning: #topLeft;
		hResizing: #spaceFill;
		vResizing: #spaceFill.
	
	"Header with title and status"
	headerPanel := self buildHeaderPanel.
	mainPanel addMorphBack: headerPanel.
	
	"Input area"
	inputPanel := self buildInputPanel.
	mainPanel addMorphBack: inputPanel.
	
	"Buttons"
	buttonPanel := self buildButtonPanel.
	mainPanel addMorphBack: buttonPanel.
	
	"Output area"
	outputPanel := self buildOutputPanel.
	mainPanel addMorphBack: outputPanel.
	
	self addMorph: mainPanel frame: (0@0 corner: 1@1)! !

!C9AIMainWindow methodsFor: 'interface' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
buildHeaderPanel
	| panel titleLabel |
	panel := Morph new
		color: (Color r: 0.1 g: 0.1 b: 0.2);
		height: 60;
		hResizing: #spaceFill;
		vResizing: #rigid.
	
	titleLabel := StringMorph new
		contents: '🚀 C9AI Agentic Tools - Powered by Squeak & llama.cpp';
		color: Color white;
		font: TextStyle defaultFont emphasized.
	
	statusLabel := StringMorph new
		contents: '● Connecting...';
		color: Color yellow.
	
	panel addMorph: titleLabel.
	panel addMorph: statusLabel.
	
	^ panel! !

!C9AIMainWindow methodsFor: 'interface' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
buildInputPanel
	| panel label |
	panel := Morph new
		color: Color veryLightGray;
		height: 100;
		hResizing: #spaceFill;
		vResizing: #rigid.
	
	label := StringMorph new
		contents: 'Enter your prompt:';
		color: Color black.
	
	promptField := PluggableTextMorph new
		width: 750;
		height: 60;
		hResizing: #spaceFill;
		vResizing: #spaceFill.
	
	panel addMorph: label.
	panel addMorph: promptField.
	
	^ panel! !

!C9AIMainWindow methodsFor: 'interface' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
buildButtonPanel
	| panel sendButton testButton clearButton |
	panel := Morph new
		color: Color lightGray;
		height: 50;
		hResizing: #spaceFill;
		vResizing: #rigid.
	
	sendButton := SimpleButtonMorph new
		label: 'Send to AI';
		target: self;
		actionSelector: #sendPrompt;
		color: (Color r: 0.2 g: 0.6 b: 0.2).
	
	testButton := SimpleButtonMorph new
		label: 'Test Connection';
		target: self;
		actionSelector: #testConnection;
		color: (Color r: 0.2 g: 0.2 b: 0.6).
	
	clearButton := SimpleButtonMorph new
		label: 'Clear';
		target: self;
		actionSelector: #clearAll;
		color: (Color r: 0.6 g: 0.2 b: 0.2).
	
	panel addMorph: sendButton.
	panel addMorph: testButton.
	panel addMorph: clearButton.
	
	^ panel! !

!C9AIMainWindow methodsFor: 'interface' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
buildOutputPanel
	| panel label |
	panel := Morph new
		color: Color white;
		hResizing: #spaceFill;
		vResizing: #spaceFill.
	
	label := StringMorph new
		contents: 'AI Response:';
		color: Color black.
	
	responseArea := PluggableTextMorph new
		hResizing: #spaceFill;
		vResizing: #spaceFill;
		readOnly: true.
	
	panel addMorph: label.
	panel addMorph: responseArea.
	
	^ panel! !

!C9AIMainWindow methodsFor: 'actions' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
sendPrompt
	| promptText response |
	promptText := promptField text asString.
	promptText isEmpty ifTrue: [^ self].
	
	self updateStatus: '● Sending to AI...' color: Color blue.
	
	[response := connector sendPrompt: promptText.
	 self displayResponse: response.
	 self updateStatus: '● Ready' color: Color green]
		fork! !

!C9AIMainWindow methodsFor: 'actions' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
testConnection
	| isHealthy |
	self updateStatus: '● Testing connection...' color: Color blue.
	
	[isHealthy := connector healthCheck.
	 isHealthy
		ifTrue: [self updateStatus: '● Connected' color: Color green]
		ifFalse: [self updateStatus: '● Connection failed' color: Color red]]
		fork! !

!C9AIMainWindow methodsFor: 'actions' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
clearAll
	promptField setText: ''.
	responseArea setText: ''! !

!C9AIMainWindow methodsFor: 'display' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
displayResponse: responseText
	responseArea setText: responseText! !

!C9AIMainWindow methodsFor: 'display' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
updateStatus: statusText color: aColor
	statusLabel contents: statusText.
	statusLabel color: aColor! !

"Class side methods"
!C9AIMainWindow class methodsFor: 'instance creation' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
open
	"Open the C9AI main window"
	^ self new openInWorld! !

!C9AIMainWindow class methodsFor: 'examples' stamp: 'C9AI 8/24/2025 08:00' prior: 0!
demo
	"Demo the C9AI interface"
	self open! !