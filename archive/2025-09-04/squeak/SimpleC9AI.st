Object subclass: #C9AIConnector
	instanceVariableNames: 'serverUrl'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Simple'!

!C9AIConnector methodsFor: 'initialization'!
initialize
	super initialize.
	serverUrl := 'http://127.0.0.1:8080'! !

!C9AIConnector methodsFor: 'testing'!
test
	"Simple test method"
	Transcript show: 'C9AI Connector created with URL: ', serverUrl; cr.
	^ true! !

!C9AIConnector class methodsFor: 'instance creation'!
new
	^ super new! !

!C9AIConnector class methodsFor: 'testing'!
simpleTest
	"Create and test a connector"
	| connector |
	connector := self new.
	^ connector test! !