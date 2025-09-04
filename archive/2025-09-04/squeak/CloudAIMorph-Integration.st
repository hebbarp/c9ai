!CloudAIMorph methodsFor: 'cloud-ai - integration'!
performCloudCheck
	"Perform comprehensive cloud AI check with SSL diagnostics"
	| queryText |
	
	queryText := queryMorph text asString.
	queryText isEmpty ifTrue: [
		^ self showMessage: 'Enter a query first'].
	
	self showMessage: 'Running SSL diagnostic and cloud AI check...'.
	checkButton color: Color orange.
	
	"Use the comprehensive approach"
	[| result |
	 result := self checkQueryWithCloudAI: queryText.
	 self showResults: result.
	 checkButton color: (Color r: 0.2 g: 0.4 b: 0.8).
	 self showMessage: 'Complete diagnostic finished'] fork! !

!CloudAIMorph methodsFor: 'cloud-ai - integration'!
quickSSLTest
	"Quick SSL test method for debugging"
	| result |
	
	result := self performSSLDiagnostic.
	self showResults: result.
	
	^ result! !

!CloudAIMorph methodsFor: 'cloud-ai - integration'!
testAllMethods: queryText
	"Test all available methods for the query"
	| results separator |
	
	separator := String new: 30 withAll: $-.
	results := 'COMPREHENSIVE CLOUD AI TEST', String cr,
		'Query: "', queryText, '"', String cr, 
		String new: 50 withAll: $=, String cr, String cr.
	
	"Test 1: SSL Diagnostic"
	results := results, 'SSL DIAGNOSTIC TEST:', String cr, separator, String cr.
	results := results, (self performSSLDiagnostic), String cr, String cr.
	
	"Test 2: Mock response (always works)"
	results := results, 'MOCK RESPONSE TEST:', String cr, separator, String cr.
	results := results, (self tryMockCloudResponse: queryText), String cr, String cr.
	
	"Test 3: Alternative methods if SSL fails"
	results := results, 'ALTERNATIVE METHODS:', String cr, separator, String cr.
	results := results, (self tryAlternativeApproaches: queryText), String cr.
	
	self showResults: results.
	^ results! !

!CloudAIMorph class methodsFor: 'testing'!
sslTest
	"Quick SSL test"
	| morph |
	morph := self new.
	^ morph quickSSLTest! !

!CloudAIMorph class methodsFor: 'testing'!
comprehensiveTest: queryText
	"Comprehensive test of all methods"
	| morph |
	morph := self new.
	^ morph testAllMethods: queryText! !

!Object class methodsFor: 'ssl testing'!
sslQuickTest
	"Quick SSL connectivity test"
	^ CloudAIMorph sslTest! !