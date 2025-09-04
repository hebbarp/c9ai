!CloudAIMorph methodsFor: 'actions'!
selectProvider
	| currentLabel newLabel newColor newProvider |
	currentLabel := providerButton label.
	
	currentLabel = 'Mock Testing' ifTrue: [
		newLabel := 'HTTP Test'.
		newColor := (Color r: 0.9 g: 1.0 b: 0.9).
		newProvider := #httpTest].
	
	currentLabel = 'HTTP Test' ifTrue: [
		newLabel := 'OpenAI API'.
		newColor := (Color r: 0.9 g: 0.9 b: 1.0).
		newProvider := #openai].
	
	currentLabel = 'OpenAI API' ifTrue: [
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
			ifFalse: [
				selectedProvider = #httpTest
					ifTrue: [result := self testHTTP: queryText]
					ifFalse: [result := self testOpenAI: queryText]].
		
		resultMorph setText: result.
		scrollPane changed.
		checkButton color: (Color r: 0.2 g: 0.4 b: 0.8).
		self showMessage: 'Test complete'
	] fork! !