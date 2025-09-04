Morph subclass: #CloudAIMorph
	instanceVariableNames: 'titleMorph queryMorph providerButton checkButton resultMorph scrollPane selectedProvider'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!CloudAIMorph commentStamp: 'C9AI 8/24/2025 18:00' prior: 0!
CloudAIMorph - Clean implementation for HTTP testing.!

!CloudAIMorph methodsFor: 'initialization'!
initialize
	super initialize.
	selectedProvider := #mock.
	self setupAppearance.
	self buildInterface.
	self enableDragging! !

!CloudAIMorph methodsFor: 'initialization'!
setupAppearance
	self color: (Color r: 0.95 g: 0.95 b: 1.0).
	self borderWidth: 2.
	self borderColor: (Color r: 0.2 g: 0.4 b: 0.8).
	self extent: 420@300.
	self layoutPolicy: TableLayout new.
	self listDirection: #topToBottom.
	self cellPositioning: #topLeft.
	self hResizing: #spaceFill.
	self vResizing: #spaceFill.
	self layoutInset: 8! !

!CloudAIMorph methodsFor: 'interface'!
buildInterface
	self removeAllMorphs.
	
	titleMorph := StringMorph new contents: 'Cloud AI Test'; color: (Color r: 0.1 g: 0.3 b: 0.7).
	queryMorph := PluggableTextMorph new extent: 380@40; color: Color white; borderWidth: 1; borderColor: Color gray.
	
	providerButton := SimpleButtonMorph new
		label: 'Mock Testing';
		target: self;
		actionSelector: #selectProvider;
		color: (Color r: 1.0 g: 0.95 b: 0.9);
		extent: 120@25.
	
	checkButton := SimpleButtonMorph new
		label: 'Test Connection';
		target: self;
		actionSelector: #performTest;
		color: (Color r: 0.2 g: 0.4 b: 0.8);
		extent: 120@25.
	
	scrollPane := ScrollPane new
		extent: 380@180;
		color: Color white;
		borderWidth: 1;
		borderColor: Color gray.
	
	resultMorph := PluggableTextMorph new
		extent: 360@160;
		setText: 'Select provider and click Test Connection';
		color: Color white;
		borderWidth: 0;
		readOnly: true;
		wrapFlag: true.
	
	scrollPane scroller addMorph: resultMorph.
	
	self addMorphBack: titleMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: queryMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: providerButton.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: checkButton.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: scrollPane! !

!CloudAIMorph methodsFor: 'interface'!
buildSpacer: height
	^ Morph new
		color: Color transparent;
		extent: 1@height;
		hResizing: #rigid;
		vResizing: #rigid! !

!CloudAIMorph methodsFor: 'actions'!
selectProvider
	| currentLabel newLabel newColor newProvider |
	currentLabel := providerButton label.
	
	currentLabel = 'Mock Testing' ifTrue: [
		newLabel := 'HTTP Test'.
		newColor := (Color r: 0.9 g: 1.0 b: 0.9).
		newProvider := #httpTest].
	
	currentLabel = 'HTTP Test' ifTrue: [
		newLabel := 'Mock Testing'.
		newColor := (Color r: 1.0 g: 0.95 b: 0.9).
		newProvider := #mock].
	
	selectedProvider := newProvider.
	providerButton label: newLabel.
	providerButton color: newColor.
	
	self showMessage: 'Selected: ', newLabel! !

!CloudAIMorph methodsFor: 'actions'!
performTest
	| queryText result |
	queryText := queryMorph text asString.
	queryText isEmpty ifTrue: [queryText := 'test query'].
	
	self showMessage: 'Testing...'.
	checkButton color: Color orange.
	
	[
		selectedProvider = #mock 
			ifTrue: [result := self testMock: queryText]
			ifFalse: [result := self testHTTP: queryText].
		
		resultMorph setText: result.
		scrollPane changed.
		checkButton color: (Color r: 0.2 g: 0.4 b: 0.8).
		self showMessage: 'Test complete'
	] fork! !

!CloudAIMorph methodsFor: 'testing'!
testMock: queryText
	^ 'MOCK TEST RESULT for: "', queryText, '"', String cr, String cr,
		'This is a simulated response to verify the interface works.', String cr,
		'Provider: Mock Testing', String cr,
		'Timestamp: ', DateAndTime now asString! !

!CloudAIMorph methodsFor: 'testing'!
testHTTP: queryText
	| socket address response data result chunkCount |
	
	result := 'HTTP CONNECTION TEST for: "', queryText, '"', String cr, String cr.
	
	[
		Transcript show: 'CloudAI: Testing HTTP connection...'; cr.
		
		socket := Socket new.
		address := NetNameResolver addressForName: 'api.openai.com' timeout: 10.
		socket connectTo: address port: 443.
		socket waitForConnectionFor: 10.
		
		result := result, 'Connection: SUCCESS', String cr.
		Transcript show: 'CloudAI: Connected successfully'; cr.
		
		"Send basic HTTP request"
		socket sendData: 'GET / HTTP/1.1', String cr, 'Host: api.openai.com', String cr, String cr.
		
		"Read response with better data collection"
		response := String new.
		chunkCount := 0.
		
		"Get all data immediately available"
		[socket dataAvailable] whileTrue: [
			data := socket receiveData.
			data ifNotNil: [
				chunkCount := chunkCount + 1.
				Transcript show: 'CloudAI: Chunk #', chunkCount printString, ' - ', data size printString, ' bytes'; cr.
				response := response, data]].
		
		"Wait a bit for any remaining data"
		3 timesRepeat: [
			socket waitForDataFor: 1.
			socket dataAvailable ifTrue: [
				data := socket receiveData.
				data ifNotNil: [
					chunkCount := chunkCount + 1.
					Transcript show: 'CloudAI: Additional chunk #', chunkCount printString, ' - ', data size printString, ' bytes'; cr.
					response := response, data]]].
		
		socket close.
		
		result := result, 'Response received: ', response size printString, ' bytes', String cr,
			'Total chunks: ', chunkCount printString, String cr, String cr.
		
		response size > 0 ifTrue: [
			result := result, 'RESPONSE CONTENT:', String cr,
				'================', String cr,
				response, String cr,
				'================'].
		
		Transcript show: 'CloudAI: Test completed - ', response size printString, ' bytes total'; cr.
		
	] on: Error do: [:ex |
		result := result, 'ERROR: ', ex messageText, String cr.
		Transcript show: 'CloudAI: Error - ', ex messageText; cr.
		socket ifNotNil: [socket close]].
	
	^ result! !

!CloudAIMorph methodsFor: 'feedback'!
showMessage: messageText
	| originalContents |
	originalContents := titleMorph contents.
	titleMorph contents: messageText.
	titleMorph color: Color blue.
	
	[(Delay forSeconds: 3) wait.
	 titleMorph contents: originalContents.
	 titleMorph color: (Color r: 0.1 g: 0.3 b: 0.7)]
		fork! !

!CloudAIMorph methodsFor: 'interaction'!
enableDragging
	self on: #mouseDown send: #startDrag: to: self.
	self on: #mouseMove send: #drag: to: self.
	self on: #mouseUp send: #endDrag: to: self! !

!CloudAIMorph methodsFor: 'interaction'!
startDrag: event
	self isDragging: true.
	self dragOffset: event position - self position! !

!CloudAIMorph methodsFor: 'interaction'!
drag: event
	self isDragging ifTrue: [
		self position: event position - self dragOffset]! !

!CloudAIMorph methodsFor: 'interaction'!
endDrag: event
	self isDragging: false! !

!CloudAIMorph methodsFor: 'accessing'!
isDragging
	^ self valueOfProperty: #isDragging ifAbsent: [false]! !

!CloudAIMorph methodsFor: 'accessing'!
isDragging: aBoolean
	self setProperty: #isDragging toValue: aBoolean! !

!CloudAIMorph methodsFor: 'accessing'!
dragOffset
	^ self valueOfProperty: #dragOffset ifAbsent: [0@0]! !

!CloudAIMorph methodsFor: 'accessing'!
dragOffset: aPoint
	self setProperty: #dragOffset toValue: aPoint! !

!CloudAIMorph class methodsFor: 'instance creation'!
demo
	"Create and show a clean CloudAIMorph for testing"
	^ self new openInWorld! !