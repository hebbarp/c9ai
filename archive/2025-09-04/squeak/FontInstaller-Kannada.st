"Font installation and detection utilities for Kannada support"

Object subclass: #KannadaFontInstaller
	instanceVariableNames: ''
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Fonts'!

!KannadaFontInstaller class methodsFor: 'font-detection'!
listAllFonts
	"List all available fonts using different Squeak APIs"
	Transcript show: '=== All Available Fonts in Squeak ==='; cr.
	
	"Method 1: TextStyle"
	[Transcript show: 'TextStyle fonts:'; cr.
	 TextStyle knownTextStyles do: [:style |
		Transcript show: '  ', style printString; cr
	 ]]
		on: Error 
		do: [:ex | Transcript show: 'TextStyle error: ', ex messageText; cr].
	
	"Method 2: LogicalFont"
	[Transcript show: 'LogicalFont families:'; cr.
	 LogicalFont familyNames do: [:family |
		Transcript show: '  ', family printString; cr
	 ]]
		on: Error
		do: [:ex | Transcript show: 'LogicalFont error: ', ex messageText; cr].
	
	"Method 3: StrikeFont"
	[Transcript show: 'Available font families:'; cr.
	 AbstractFont familyNames do: [:family |
		Transcript show: '  ', family printString; cr
	 ]]
		on: Error
		do: [:ex | Transcript show: 'AbstractFont error: ', ex messageText; cr]! !

!KannadaFontInstaller class methodsFor: 'font-detection'!
findKannadaFonts
	"Search for any Kannada-related fonts using multiple methods"
	| foundFonts |
	foundFonts := OrderedCollection new.
	
	Transcript show: '=== Searching for Kannada Fonts ==='; cr.
	
	"Search in TextStyle"
	[TextStyle knownTextStyles do: [:styleName |
		| lowerName |
		lowerName := styleName asString asLowercase.
		(lowerName includesSubstring: 'kannada') ifTrue: [
			foundFonts add: styleName.
			Transcript show: 'Found in TextStyle: ', styleName; cr
		]
	 ]]
		on: Error do: [:ex | Transcript show: 'TextStyle search error: ', ex messageText; cr].
	
	"Search in LogicalFont families"
	[LogicalFont familyNames do: [:family |
		| lowerName |
		lowerName := family asLowercase.
		(lowerName includesSubstring: 'kannada') ifTrue: [
			foundFonts add: family.
			Transcript show: 'Found in LogicalFont: ', family; cr
		]
	 ]]
		on: Error do: [:ex | Transcript show: 'LogicalFont search error: ', ex messageText; cr].
	
	"Search in AbstractFont"
	[AbstractFont familyNames do: [:family |
		| lowerName |
		lowerName := family asLowercase.
		(lowerName includesSubstring: 'kannada') ifTrue: [
			foundFonts add: family.
			Transcript show: 'Found in AbstractFont: ', family; cr
		]
	 ]]
		on: Error do: [:ex | Transcript show: 'AbstractFont search error: ', ex messageText; cr].
	
	foundFonts isEmpty ifTrue: [
		Transcript show: 'No Kannada fonts found in Squeak font system'; cr
	].
	
	^ foundFonts! !

!KannadaFontInstaller class methodsFor: 'font-installation'!
installSystemFont: fontName
	"Attempt to install a system font into Squeak"
	| logicalFont |
	
	Transcript show: 'Attempting to install font: ', fontName; cr.
	
	[logicalFont := LogicalFont familyName: fontName.
	 logicalFont ifNotNil: [
		Transcript show: 'Successfully created LogicalFont for: ', fontName; cr.
		^ logicalFont
	 ] ifNil: [
		Transcript show: 'Could not create LogicalFont for: ', fontName; cr
	 ]]
		on: Error
		do: [:ex | 
			Transcript show: 'Font installation error: ', ex messageText; cr].
	
	^ nil! !

!KannadaFontInstaller class methodsFor: 'font-installation'!
tryKannadaFontNames
	"Try various possible names for Kannada fonts"
	| possibleNames foundFont |
	possibleNames := #(
		'Noto Sans Kannada'
		'NotoSansKannada'
		'Noto Kannada'
		'NotKannada'
		'Kannada Sangam MN'
		'Tunga'
		'Kedage'
		'Lohit Kannada'
	).
	
	Transcript show: '=== Trying Kannada Font Names ==='; cr.
	
	possibleNames do: [:fontName |
		Transcript show: 'Trying: ', fontName; cr.
		foundFont := self installSystemFont: fontName.
		foundFont ifNotNil: [
			Transcript show: 'SUCCESS: Found working font: ', fontName; cr.
			^ foundFont
		]
	].
	
	Transcript show: 'No working Kannada fonts found'; cr.
	^ nil! !

!KannadaFontInstaller class methodsFor: 'testing'!
testKannadaFontRendering: fontName
	"Test rendering Kannada text with a specific font"
	| textMorph logicalFont |
	
	[logicalFont := LogicalFont familyName: fontName.
	 logicalFont ifNil: [
		^ 'Font not available: ', fontName
	 ].
	 
	 textMorph := TextMorph new.
	 textMorph contents: 'ಕನ್ನಡ ಭಾಷೆ ಪರೀಕ್ಷೆ'.
	 textMorph font: logicalFont.
	 textMorph openInWorld.
	 
	 Transcript show: 'Opened test text with font: ', fontName; cr.
	 ^ textMorph]
		on: Error
		do: [:ex |
			Transcript show: 'Font test error for ', fontName, ': ', ex messageText; cr.
			^ nil]! !

!KannadaFontInstaller class methodsFor: 'installation-help'!
installationInstructions
	"Show instructions for installing Kannada fonts in Squeak"
	Transcript show: '=== Kannada Font Installation Instructions ==='; cr.
	Transcript show: '1. Download Noto Sans Kannada from Google Fonts'; cr.
	Transcript show: '2. Install the font at system level (macOS Font Book)'; cr.
	Transcript show: '3. In Squeak, try: LogicalFont familyName: ''Noto Sans Kannada'''; cr.
	Transcript show: '4. Or use Squeak font installation: World menu > Appearance > Install Fonts'; cr.
	Transcript show: '5. Alternative: Use TrueType font files directly in Squeak'; cr.
	Transcript show: '================================================'; cr! !

!KannadaFontInstaller class methodsFor: 'demo'!
fullFontSearch
	"Complete font search and installation attempt"
	self listAllFonts.
	self findKannadaFonts.
	self tryKannadaFontNames.
	self installationInstructions! !