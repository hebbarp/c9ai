Object subclass: #C9AILlamaClient
	instanceVariableNames: 'serverUrl'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Core'!

!C9AILlamaClient methodsFor: 'initialization'!
initialize
	super initialize.
	serverUrl := 'http://127.0.0.1:8080'! !

!C9AILlamaClient methodsFor: 'connection'!
testHealth
	"Test if llama.cpp server is responding"
	| response |
	Transcript show: 'Testing health at: ', serverUrl; cr.
	[response := HTTPSocket httpGet: serverUrl, '/health'.
	 Transcript show: 'Server is healthy'; cr.
	 ^ true]
		on: Error
		do: [:ex | 
			Transcript show: 'Health check failed: ', ex messageText; cr.
			^ false]! !

!C9AILlamaClient methodsFor: 'ai-api'!
completion: promptText
	"Send completion request to llama.cpp"
	| jsonBody response |
	jsonBody := '{"prompt":"', promptText, '","max_tokens":50,"stream":false}'.
	
	Transcript show: 'Sending completion request...'; cr.
	
	[response := HTTPSocket 
		httpPost: serverUrl, '/completion'
		content: jsonBody
		type: 'application/json'
		accept: 'application/json'
		request: nil.
	 Transcript show: 'Completion response received'; cr.
	 ^ response]
		on: Error
		do: [:ex |
			Transcript show: 'Completion error: ', ex messageText; cr.
			^ nil]! !

!C9AILlamaClient class methodsFor: 'instance creation'!
new
	^ super new! !

SystemWindow subclass: #C9AIWindow
	instanceVariableNames: 'aiClient promptInput responseText statusLabel'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Core'!

!C9AIWindow methodsFor: 'initialization'!
initialize
	super initialize.
	aiClient := C9AILlamaClient new.
	self setLabel: 'C9AI Agentic Tools'.
	self extent: 500@400.
	self center.
	self buildInterface! !

!C9AIWindow methodsFor: 'interface'!
buildInterface
	| mainPanel headerPanel inputPanel buttonPanel outputPanel |
	
	mainPanel := Morph new
		layoutPolicy: TableLayout new;
		listDirection: #topToBottom;
		hResizing: #spaceFill;
		vResizing: #spaceFill;
		color: Color white.
	
	headerPanel := StringMorph new
		contents: 'C9AI - Local AI Interface';
		color: Color blue.
	
	promptInput := PluggableTextMorph new
		height: 60;
		hResizing: #spaceFill;
		vResizing: #rigid.
	
	buttonPanel := SimpleButtonMorph new
		label: 'Send to AI';
		target: self;
		actionSelector: #sendPrompt;
		color: Color lightGreen.
	
	responseText := PluggableTextMorph new
		hResizing: #spaceFill;
		vResizing: #spaceFill.
	
	statusLabel := StringMorph new
		contents: 'Ready';
		color: Color green.
	
	mainPanel addMorphBack: headerPanel.
	mainPanel addMorphBack: promptInput.
	mainPanel addMorphBack: buttonPanel.
	mainPanel addMorphBack: responseText.
	mainPanel addMorphBack: statusLabel.
	
	self addMorph: mainPanel frame: (0@0 corner: 1@1)! !

!C9AIWindow methodsFor: 'actions'!
sendPrompt
	"Send prompt to AI and display response"
	| prompt response |
	prompt := promptInput text asString.
	prompt isEmpty ifTrue: [^ self].
	
	statusLabel contents: 'Sending to AI...'.
	
	response := aiClient completion: prompt.
	
	response 
		ifNotNil: [responseText setText: response asString]
		ifNil: [responseText setText: 'No response received'].
	
	statusLabel contents: 'Ready'! !

!C9AIWindow class methodsFor: 'instance creation'!
open
	"Open the C9AI window"
	^ self new openInWorld! !