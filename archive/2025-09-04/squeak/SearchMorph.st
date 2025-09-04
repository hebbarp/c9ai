Morph subclass: #SearchMorph
	instanceVariableNames: 'titleMorph queryMorph searchButton resultMorph searchHistory scrollPane'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Morphs'!

!SearchMorph commentStamp: 'C9AI 8/24/2025 17:30' prior: 0!
SearchMorph performs web searches for fact verification.
Integrates with ResponseMorph verification buttons to check AI responses against web sources.
Uses HTTPSocket to query search engines and extract relevant information.

Usage:
  SearchMorph new openInWorld.
  SearchMorph searchFor: 'who founded Apple'.!

!SearchMorph methodsFor: 'initialization'!
initialize
	super initialize.
	searchHistory := OrderedCollection new.
	self setupAppearance.
	self buildInterface.
	self enableDragging! !

!SearchMorph methodsFor: 'initialization'!
setupAppearance
	self color: (Color r: 0.95 g: 0.98 b: 0.95).
	self borderWidth: 2.
	self borderColor: (Color r: 0.7 g: 0.4 b: 0.2).
	self extent: 400@350.
	self layoutPolicy: TableLayout new.
	self listDirection: #topToBottom.
	self cellPositioning: #topLeft.
	self hResizing: #spaceFill.
	self vResizing: #spaceFill.
	self layoutInset: 8! !

!SearchMorph methodsFor: 'interface'!
buildInterface
	self removeAllMorphs.
	
	titleMorph := self buildTitle.
	queryMorph := self buildQueryInput.
	searchButton := self buildSearchButton.
	scrollPane := self buildResultPane.
	
	self addMorphBack: titleMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: queryMorph.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: searchButton.
	self addMorphBack: (self buildSpacer: 8).
	self addMorphBack: scrollPane! !

!SearchMorph methodsFor: 'interface'!
buildTitle
	| title |
	title := StringMorph new
		contents: 'Web Search Verification';
		color: (Color r: 0.6 g: 0.3 b: 0.1).
	^ title! !

!SearchMorph methodsFor: 'interface'!
buildQueryInput
	| input |
	input := PluggableTextMorph new
		extent: 360@40;
		color: Color white;
		borderWidth: 1;
		borderColor: Color gray;
		hResizing: #spaceFill;
		vResizing: #rigid.
	^ input! !

!SearchMorph methodsFor: 'interface'!
buildSearchButton
	| button |
	button := SimpleButtonMorph new
		label: 'Search Web';
		target: self;
		actionSelector: #performSearch;
		color: (Color r: 0.7 g: 0.4 b: 0.2);
		extent: 120@25.
	^ button! !

!SearchMorph methodsFor: 'interface'!
buildResultPane
	| pane |
	pane := ScrollPane new
		extent: 360@220;
		color: Color white;
		borderWidth: 1;
		borderColor: Color gray;
		hResizing: #spaceFill;
		vResizing: #spaceFill.
	
	resultMorph := self buildResultMorph.
	pane scroller addMorph: resultMorph.
	^ pane! !

!SearchMorph methodsFor: 'interface'!
buildResultMorph
	| result |
	result := PluggableTextMorph new
		extent: 340@200;
		setText: 'Enter a search query and click Search Web to verify facts.';
		color: Color white;
		borderWidth: 0;
		readOnly: true;
		wrapFlag: true;
		hResizing: #spaceFill;
		vResizing: #shrinkWrap.
	^ result! !

!SearchMorph methodsFor: 'interface'!
buildSpacer: height
	"Create a transparent spacer morph"
	^ Morph new
		color: Color transparent;
		extent: 1@height;
		hResizing: #rigid;
		vResizing: #rigid! !

!SearchMorph methodsFor: 'search'!
performSearch
	"Perform web search with the entered query"
	| queryText |
	queryText := queryMorph text asString.
	queryText isEmpty ifTrue: [
		^ self showMessage: 'Enter a search query first'].
	
	self showMessage: 'Searching...'.
	searchButton color: Color orange.
	
	[self searchFor: queryText.
	 searchButton color: (Color r: 0.7 g: 0.4 b: 0.2)] fork! !

!SearchMorph methodsFor: 'search'!
searchFor: queryText
	"Perform web search for the given query"
	| searchResults |
	
	self showStatus: 'Searching for: ', queryText.
	
	"Try different search approaches"
	searchResults := self tryDuckDuckGoSearch: queryText.
	
	searchResults ifNil: [
		searchResults := self tryHttpBinSearch: queryText].
	
	searchResults ifNil: [
		searchResults := self createNoResultsMessage: queryText].
	
	"Store in history"
	self addToHistory: queryText results: searchResults.
	
	"Update display"
	self showResults: searchResults! !

!SearchMorph methodsFor: 'search-engines'!
tryDuckDuckGoSearch: queryText
	"Try searching with DuckDuckGo instant answer API"
	| socket response url encodedQuery |
	
	[
		"Encode the query for URL"
		encodedQuery := self urlEncode: queryText.
		url := 'https://api.duckduckgo.com/instant?q=', encodedQuery, '&format=json&no_html=1&skip_disambig=1'.
		
		"Create HTTP request"
		socket := self createHttpSocket: 'api.duckduckgo.com' port: 443.
		socket ifNil: [^ nil].
		
		"Send HTTP request"
		response := self sendHttpRequest: socket url: url host: 'api.duckduckgo.com'.
		socket close.
		
		response ifNotNil: [
			^ self parseDuckDuckGoResponse: response query: queryText].
		
	] on: Error do: [:ex |
		socket ifNotNil: [socket close].
		^ nil].
	
	^ nil! !

!SearchMorph methodsFor: 'search-engines'!
tryHttpBinSearch: queryText
	"Try a simple HTTP test to validate connectivity"
	| socket response |
	
	[
		"Test basic HTTP connectivity"
		socket := self createHttpSocket: 'httpbin.org' port: 80.
		socket ifNil: [^ nil].
		
		"Send simple GET request"
		socket sendData: 'GET /get HTTP/1.1', String cr, 'Host: httpbin.org', String cr, String cr.
		response := self readHttpResponse: socket.
		socket close.
		
		response ifNotNil: [
			^ 'HTTP connectivity verified. Search query: "', queryText, '"', String cr, String cr,
			  'Note: This is a connectivity test. Real search integration would require:', String cr,
			  '1. API keys for search services (Google, Bing, etc.)', String cr,
			  '2. JSON parsing for search results', String cr,
			  '3. Result ranking and relevance filtering', String cr, String cr,
			  'Raw response preview: ', (response copyFrom: 1 to: (200 min: response size))].
		
	] on: Error do: [:ex |
		socket ifNotNil: [socket close].
		^ nil].
	
	^ nil! !

!SearchMorph methodsFor: 'http-utilities'!
createHttpSocket: hostname port: portNumber
	"Create and connect an HTTP socket"
	| socket address |
	
	[
		socket := Socket new.
		address := NetNameResolver addressForName: hostname timeout: 10.
		address ifNil: [^ nil].
		
		socket connectTo: address port: portNumber.
		socket waitForConnectionFor: 10.
		socket isConnected ifFalse: [^ nil].
		
		^ socket
		
	] on: Error do: [:ex |
		socket ifNotNil: [socket close].
		^ nil]! !

!SearchMorph methodsFor: 'http-utilities'!
sendHttpRequest: socket url: urlString host: hostString
	"Send HTTP GET request and read response"
	| request response |
	
	[
		request := 'GET ', urlString, ' HTTP/1.1', String cr,
			'Host: ', hostString, String cr,
			'User-Agent: SqueakSearchMorph/1.0', String cr,
			'Accept: application/json, text/html', String cr,
			'Connection: close', String cr, String cr.
		
		socket sendData: request.
		response := self readHttpResponse: socket.
		^ response
		
	] on: Error do: [:ex |
		^ nil]! !

!SearchMorph methodsFor: 'http-utilities'!
readHttpResponse: socket
	"Read HTTP response from socket"
	| response data |
	
	[
		response := String new.
		
		"Read response with timeout"
		10 timesRepeat: [
			socket waitForDataFor: 2.
			socket dataAvailable ifTrue: [
				data := socket receiveData.
				data ifNotNil: [
					response := response, data]]].
		
		^ response
		
	] on: Error do: [:ex |
		^ nil]! !

!SearchMorph methodsFor: 'http-utilities'!
urlEncode: text
	"Basic URL encoding for search queries"
	| encoded |
	encoded := text.
	encoded := encoded copyReplaceAll: ' ' with: '+'.
	encoded := encoded copyReplaceAll: '&' with: '%26'.
	encoded := encoded copyReplaceAll: '=' with: '%3D'.
	^ encoded! !

!SearchMorph methodsFor: 'response-parsing'!
parseDuckDuckGoResponse: response query: queryText
	"Parse DuckDuckGo JSON response (basic implementation)"
	| result |
	
	"Look for instant answer in response"
	(response includesSubstring: '"Answer"') ifTrue: [
		result := 'SEARCH RESULTS for: "', queryText, '"', String cr, String cr,
			'Found instant answer from DuckDuckGo:', String cr,
			self extractAnswerFromJson: response].
	
	result ifNil: [
		result := 'SEARCH COMPLETED for: "', queryText, '"', String cr, String cr,
			'DuckDuckGo API response received but no instant answer found.', String cr,
			'This may indicate:', String cr,
			'- Query requires more detailed web search', String cr,
			'- Information not available in instant answer format', String cr,
			'- Need to parse full search results instead of instant answers'].
	
	^ result! !

!SearchMorph methodsFor: 'response-parsing'!
extractAnswerFromJson: jsonText
	"Extract answer from JSON response (simple string parsing)"
	| startPos endPos answer |
	
	"Find the Answer field"
	startPos := jsonText findString: '"Answer":"'.
	startPos = 0 ifTrue: [^ 'Answer field not found in response'].
	
	startPos := startPos + 10. "Skip past the field name"
	endPos := jsonText findString: '"' startingAt: startPos.
	endPos = 0 ifTrue: [^ 'Could not parse answer from response'].
	
	answer := jsonText copyFrom: startPos to: endPos - 1.
	^ answer isEmpty 
		ifTrue: ['Empty answer received'] 
		ifFalse: [answer]! !

!SearchMorph methodsFor: 'search-fallback'!
createNoResultsMessage: queryText
	"Create a message when no search results are available"
	^ 'SEARCH ATTEMPTED for: "', queryText, '"', String cr, String cr,
		'Unable to connect to search services. This could be due to:', String cr,
		'- Network connectivity issues', String cr,
		'- Search API rate limits or blocks', String cr,
		'- Need for authentication/API keys', String cr, String cr,
		'For production use, implement:', String cr,
		'1. Google Custom Search API with API key', String cr,
		'2. Bing Web Search API', String cr,
		'3. Local web scraping with HTML parsing', String cr,
		'4. Cached/offline knowledge base lookup', String cr, String cr,
		'Search verification is important for fact-checking AI responses.'! !

!SearchMorph methodsFor: 'history'!
addToHistory: queryText results: resultsText
	"Add search to history"
	searchHistory add: (Dictionary new
		at: #query put: queryText;
		at: #results put: resultsText;
		at: #timestamp put: DateAndTime now;
		yourself).
	
	"Log to transcript"
	Transcript show: '=== Web Search ==='; cr.
	Transcript show: 'Query: ', queryText; cr.
	Transcript show: 'Results: ', (resultsText copyFrom: 1 to: (100 min: resultsText size)), '...'; cr.
	Transcript show: '================='; cr! !

!SearchMorph methodsFor: 'display'!
showResults: resultsText
	"Display search results"
	resultMorph setText: resultsText.
	scrollPane changed.
	self showMessage: 'Search completed'! !

!SearchMorph methodsFor: 'display'!
showStatus: statusText
	"Show search status"
	resultMorph setText: 'STATUS: ', statusText, String cr, String cr, 
		'Searching web for factual information...'.
	scrollPane changed! !

!SearchMorph methodsFor: 'feedback'!
showMessage: messageText
	"Show a temporary message in the title"
	| originalContents |
	originalContents := titleMorph contents.
	titleMorph contents: messageText.
	titleMorph color: Color blue.
	
	"Reset after 3 seconds"
	[(Delay forSeconds: 3) wait.
	 titleMorph contents: originalContents.
	 titleMorph color: (Color r: 0.6 g: 0.3 b: 0.1)]
		fork! !

!SearchMorph methodsFor: 'interaction'!
enableDragging
	"Make the morph draggable"
	self on: #mouseDown send: #startDrag: to: self.
	self on: #mouseMove send: #drag: to: self.
	self on: #mouseUp send: #endDrag: to: self! !

!SearchMorph methodsFor: 'interaction'!
startDrag: event
	"Start dragging the morph"
	self isDragging: true.
	self dragOffset: event position - self position! !

!SearchMorph methodsFor: 'interaction'!
drag: event
	"Drag the morph around"
	self isDragging ifTrue: [
		self position: event position - self dragOffset
	]! !

!SearchMorph methodsFor: 'interaction'!
endDrag: event
	"End dragging"
	self isDragging: false! !

!SearchMorph methodsFor: 'accessing'!
isDragging
	"Check if currently being dragged"
	^ self valueOfProperty: #isDragging ifAbsent: [false]! !

!SearchMorph methodsFor: 'accessing'!
isDragging: aBoolean
	"Set dragging state"
	self setProperty: #isDragging toValue: aBoolean! !

!SearchMorph methodsFor: 'accessing'!
dragOffset
	"Get drag offset"
	^ self valueOfProperty: #dragOffset ifAbsent: [0@0]! !

!SearchMorph methodsFor: 'accessing'!
dragOffset: aPoint
	"Set drag offset"
	self setProperty: #dragOffset toValue: aPoint! !

!SearchMorph methodsFor: 'accessing'!
setQueryText: queryText
	"Set the search query text"
	queryMorph setText: queryText! !

!SearchMorph class methodsFor: 'instance creation'!
demo
	"Create and show a SearchMorph"
	^ self new openInWorld! !

!SearchMorph class methodsFor: 'instance creation'!
searchFor: queryText
	"Create SearchMorph and perform specific search"
	| morph |
	morph := self new.
	morph openInWorld.
	morph setQueryText: queryText.
	morph performSearch.
	^ morph! !