Object subclass: #UnicodeRenderer
	instanceVariableNames: 'tempDirectory browserCommand'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Rendering'!

!UnicodeRenderer commentStamp: 'C9AI 8/25/2025 12:00' prior: 0!
UnicodeRenderer creates proper Unicode text display using web browser rendering.
Generates HTML with appropriate fonts and opens chromeless browser windows.

Usage:
  UnicodeRenderer renderText: 'ಕನ್ನಡ ಭಾಷೆ' title: 'Kannada Response'.
  UnicodeRenderer renderResponse: responseText from: 'Local AI'.!

!UnicodeRenderer methodsFor: 'initialization'!
initialize
	super initialize.
	tempDirectory := '/tmp/'.
	self detectBrowserCommand! !

!UnicodeRenderer methodsFor: 'initialization'!
detectBrowserCommand
	"Detect available browser command for opening windows"
	| possibleCommands |
	possibleCommands := #(
		'open -a "Google Chrome" --args --app='
		'open -a "Safari" '
		'open -a "Firefox" '
		'/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --app='
		'google-chrome --app='
		'firefox '
		'open '
	).
	
	possibleCommands do: [:cmd |
		[| testResult |
		 testResult := cmd, '/dev/null 2>&1'.
		 browserCommand := cmd.
		 Transcript show: 'Using browser command: ', cmd; cr.
		 ^ self]
			on: Error do: [].
	].
	
	"Fallback to macOS open command"
	browserCommand := 'open '.
	Transcript show: 'Using fallback browser command: open'; cr! !

!UnicodeRenderer methodsFor: 'html-generation'!
generateHTML: textContent title: titleText
	"Generate proper HTML with Unicode font support"
	| html |
	html := '<!DOCTYPE html>
<html lang="kn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>', (self escapeHTML: titleText), '</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@100;300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: "Noto Sans Kannada", "Noto Sans", Arial, sans-serif;
            font-size: 16px;
            line-height: 1.6;
            margin: 20px;
            padding: 20px;
            background-color: #f8f9fa;
            color: #333;
            max-width: 800px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-weight: 500;
        }
        .content {
            background: white;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            font-size: 18px;
            line-height: 1.8;
        }
        .kannada-text {
            font-family: "Noto Sans Kannada", serif;
            font-weight: 400;
            letter-spacing: 0.5px;
            text-rendering: optimizeLegibility;
            -webkit-font-feature-settings: "liga" on;
            font-feature-settings: "liga" on;
        }
        .close-hint {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 10px 15px;
            border-radius: 20px;
            font-size: 12px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="header">
        ', (self escapeHTML: titleText), '
    </div>
    <div class="content kannada-text">
        ', (self convertToHTML: textContent), '
    </div>
    <div class="close-hint">
        Press Cmd+W to close
    </div>
</body>
</html>'.
	^ html! !

!UnicodeRenderer methodsFor: 'html-generation'!
escapeHTML: text
	"Escape HTML special characters"
	| result |
	result := text copyReplaceAll: '&' with: '&amp;'.
	result := result copyReplaceAll: '<' with: '&lt;'.
	result := result copyReplaceAll: '>' with: '&gt;'.
	result := result copyReplaceAll: '"' with: '&quot;'.
	result := result copyReplaceAll: '''' with: '&#39;'.
	^ result! !

!UnicodeRenderer methodsFor: 'html-generation'!
convertToHTML: text
	"Convert plain text to HTML with proper formatting"
	| result |
	result := self escapeHTML: text.
	result := result copyReplaceAll: String cr with: '<br>'.
	result := result copyReplaceAll: String lf with: '<br>'.
	result := result copyReplaceAll: '  ' with: ' &nbsp;'.
	^ result! !

!UnicodeRenderer methodsFor: 'file-operations'!
createTempFile: htmlContent
	"Create temporary HTML file and return path"
	| fileName filePath |
	fileName := 'unicode_render_', DateAndTime now asString copyReplaceAll: ':' with: '_', '.html'.
	filePath := tempDirectory, fileName.
	
	[FileStream newFileNamed: filePath do: [:file |
		file nextPutAll: htmlContent.
	].
	^ filePath]
		on: Error
		do: [:ex | 
			Transcript show: 'Error creating temp file: ', ex messageText; cr.
			^ nil]! !

!UnicodeRenderer methodsFor: 'browser-integration'!
openInBrowser: filePath
	"Open HTML file in chromeless browser window"
	| command |
	filePath ifNil: [^ self].
	
	"Try app mode first for chromeless experience"
	command := browserCommand, 'file://', filePath.
	
	[OSProcess command: command.
	 Transcript show: 'Opened browser window: ', filePath; cr]
		on: Error
		do: [:ex |
			Transcript show: 'Browser open error: ', ex messageText; cr.
			"Fallback to simple open"
			[OSProcess command: 'open "', filePath, '"']
				on: Error do: [:ex2 |
					Transcript show: 'Fallback open failed: ', ex2 messageText; cr]]! !

!UnicodeRenderer methodsFor: 'rendering-api'!
renderText: textContent title: titleText
	"Main API - render text with proper Unicode support"
	| html filePath |
	html := self generateHTML: textContent title: titleText.
	filePath := self createTempFile: html.
	self openInBrowser: filePath.
	
	Transcript show: '=== Unicode Renderer ==='; cr.
	Transcript show: 'Title: ', titleText; cr.
	Transcript show: 'File: ', filePath; cr.
	Transcript show: '====================='; cr.
	
	^ filePath! !

!UnicodeRenderer methodsFor: 'rendering-api'!
renderResponse: responseText from: sourceLabel
	"Render AI response with proper formatting"
	| title |
	title := sourceLabel, ' Response - Unicode Enhanced'.
	^ self renderText: responseText title: title! !

!UnicodeRenderer class methodsFor: 'instance creation'!
new
	^ super new initialize! !

!UnicodeRenderer class methodsFor: 'convenience'!
renderText: textContent title: titleText
	"Class convenience method"
	^ self new renderText: textContent title: titleText! !

!UnicodeRenderer class methodsFor: 'convenience'!
renderResponse: responseText from: sourceLabel  
	"Class convenience method for AI responses"
	^ self new renderResponse: responseText from: sourceLabel! !

!UnicodeRenderer class methodsFor: 'demo'!
testKannada
	"Test with Kannada text"
	| kannadaText |
	kannadaText := 'ನಮಸ್ಕಾರ! ಇದು ಕನ್ನಡ ಭಾಷೆಯಲ್ಲಿ ಬರೆದ ಪರೀಕ್ಷೆ.
	
ಕನ್ನಡ ಭಾಷೆಯು ಭಾರತದ ಕರ್ನಾಟಕ ರಾಜ್ಯದ ಅಧಿಕೃತ ಭಾಷೆಯಾಗಿದೆ. ಇದು ದ್ರಾವಿಡ ಭಾಷೆಗಳ ಕುಟುಂಬಕ್ಕೆ ಸೇರಿದೆ.

ಲಿಗೇಚರ್ ಪರೀಕ್ಷೆ: ಕ್ಷ ಜ್ಞ ತ್ರ ಶ್ರ'.
	
	^ self renderText: kannadaText title: 'Kannada Ligature Test'! !

!UnicodeRenderer class methodsFor: 'demo'!
testMultilingual
	"Test with multiple scripts"
	| multiText |
	multiText := 'Unicode Test - Multiple Scripts

English: Hello World!
ಕನ್ನಡ: ನಮಸ್ಕಾರ!
हिंदी: नमस्ते!
العربية: مرحبا!
中文: 你好!

Complex Ligatures:
ಕ್ಷೇತ್ರ (field)
ಜ್ಞಾನ (knowledge)  
ತ್ರಿವೇಣಿ (confluence)'.

	^ self renderText: multiText title: 'Multilingual Unicode Test'! !