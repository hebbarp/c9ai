!CloudAIMorph methodsFor: 'actions'!
selectProvider
	| currentLabel newLabel newColor newProvider |
	currentLabel := providerButton label.
	
	currentLabel = 'Mock Testing' ifTrue: [
		newLabel := 'HTTP:80 Test'.
		newColor := (Color r: 0.9 g: 1.0 b: 0.9).
		newProvider := #http80].
	
	currentLabel = 'HTTP:80 Test' ifTrue: [
		newLabel := 'HTTPS:443 Test'.
		newColor := (Color r: 1.0 g: 0.9 b: 0.9).
		newProvider := #https443].
	
	currentLabel = 'HTTPS:443 Test' ifTrue: [
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
				selectedProvider = #http80
					ifTrue: [result := self testHTTP80: queryText]
					ifFalse: [result := self testHTTP: queryText]].
		
		resultMorph setText: result.
		scrollPane changed.
		checkButton color: (Color r: 0.2 g: 0.4 b: 0.8).
		self showMessage: 'Test complete'
	] fork! !