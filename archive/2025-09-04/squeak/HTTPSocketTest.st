!Object class methodsFor: 'testing'!
testOpenAIHTTPSocket
	"Simple test of OpenAI HTTPSocket connection"
	| socket address response data |
	
	[
		Transcript show: 'HTTP Test: Creating socket...'; cr.
		socket := Socket new.
		address := NetNameResolver addressForName: 'api.openai.com' timeout: 10.
		socket connectTo: address port: 443.
		socket waitForConnectionFor: 10.
		
		Transcript show: 'HTTP Test: Socket connected: ', socket isConnected printString; cr.
		
		"Send simple HTTP request"
		socket sendData: 'GET / HTTP/1.1', String cr, 'Host: api.openai.com', String cr, String cr.
		
		"Read response"
		response := String new.
		5 timesRepeat: [
			socket waitForDataFor: 2.
			socket dataAvailable ifTrue: [
				data := socket receiveData.
				data ifNotNil: [
					Transcript show: 'HTTP Test: Received ', data size printString, ' bytes'; cr.
					response := response, data]]].
		
		socket close.
		
		Transcript show: 'HTTP Test: Total response: ', response size printString, ' bytes'; cr.
		Transcript show: 'HTTP Test: Response content: ', (response copyFrom: 1 to: (200 min: response size)); cr.
		
	] on: Error do: [:ex |
		Transcript show: 'HTTP Test Error: ', ex messageText; cr.
		socket ifNotNil: [socket close]]! !