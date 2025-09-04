Object subclass: #C9AIWebComponent
	instanceVariableNames: 'session request'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIWebComponent methodsFor: 'rendering'!
renderContentOn: html
	"Subclasses override this method"
	html h1: 'Default Web Component'! !

!C9AIWebComponent methodsFor: 'accessing'!
session: aSession
	session := aSession! !

!C9AIWebComponent methodsFor: 'accessing'!
request: aRequest
	request := aRequest! !

!C9AIWebComponent methodsFor: 'rendering'!
renderOn: html
	"Main rendering entry point"
	html doctype.
	html html: [
		html head: [
			html meta charset: 'UTF-8'.
			html title: self pageTitle.
			html link rel: 'stylesheet' href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;700&display=swap'.
			self renderHeadOn: html
		].
		html body: [
			self renderContentOn: html
		]
	]! !

!C9AIWebComponent methodsFor: 'rendering'!
renderHeadOn: html
	"Override to add custom head content"! !

!C9AIWebComponent methodsFor: 'accessing'!
pageTitle
	^ 'C9AI Application'! !

Object subclass: #C9AIHTMLCanvas
	instanceVariableNames: 'stream indentLevel'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIHTMLCanvas methodsFor: 'initialization'!
initialize
	super initialize.
	stream := WriteStream on: String new.
	indentLevel := 0! !

!C9AIHTMLCanvas methodsFor: 'private'!
indent
	indentLevel timesRepeat: [stream nextPutAll: '  ']! !

!C9AIHTMLCanvas methodsFor: 'private'!
tag: tagName content: contentBlock
	self indent.
	stream nextPutAll: '<'; nextPutAll: tagName; nextPutAll: '>'.
	contentBlock ifNotNil: [
		stream cr.
		indentLevel := indentLevel + 1.
		contentBlock value.
		indentLevel := indentLevel - 1.
		self indent
	].
	stream nextPutAll: '</'; nextPutAll: tagName; nextPutAll: '>'; cr! !

!C9AIHTMLCanvas methodsFor: 'private'!
selfClosingTag: tagName attributes: attrDict
	self indent.
	stream nextPutAll: '<'; nextPutAll: tagName.
	attrDict ifNotNil: [
		attrDict keysAndValuesDo: [:key :value |
			stream nextPutAll: ' '; nextPutAll: key; nextPutAll: '="'; nextPutAll: value; nextPutAll: '"'
		]
	].
	stream nextPutAll: ' />'; cr! !

!C9AIHTMLCanvas methodsFor: 'tags'!
doctype
	stream nextPutAll: '<'; nextPutAll: (Character value: 33) asString; nextPutAll: 'DOCTYPE html>'; cr! !

!C9AIHTMLCanvas methodsFor: 'tags'!
html: contentBlock
	self tag: 'html' content: contentBlock! !

!C9AIHTMLCanvas methodsFor: 'tags'!
head: contentBlock
	self tag: 'head' content: contentBlock! !

!C9AIHTMLCanvas methodsFor: 'tags'!
body: contentBlock
	self tag: 'body' content: contentBlock! !

!C9AIHTMLCanvas methodsFor: 'tags'!
h1: text
	self indent.
	stream nextPutAll: '<h1>'; nextPutAll: text; nextPutAll: '</h1>'; cr! !

!C9AIHTMLCanvas methodsFor: 'tags'!
h2: text
	self indent.
	stream nextPutAll: '<h2>'; nextPutAll: text; nextPutAll: '</h2>'; cr! !

!C9AIHTMLCanvas methodsFor: 'tags'!
p: text
	self indent.
	stream nextPutAll: '<p>'; nextPutAll: text; nextPutAll: '</p>'; cr! !

!C9AIHTMLCanvas methodsFor: 'tags'!
div: contentBlock
	self tag: 'div' content: contentBlock! !

!C9AIHTMLCanvas methodsFor: 'tags'!
divClass: className content: contentBlock
	self indent.
	stream nextPutAll: '<div class="'; nextPutAll: className; nextPutAll: '">'; cr.
	indentLevel := indentLevel + 1.
	contentBlock value.
	indentLevel := indentLevel - 1.
	self indent.
	stream nextPutAll: '</div>'; cr! !

!C9AIHTMLCanvas methodsFor: 'tags'!
button: text onclick: jsCode
	self indent.
	stream nextPutAll: '<button onclick="'; nextPutAll: jsCode; nextPutAll: '">'.
	stream nextPutAll: text; nextPutAll: '</button>'; cr! !

!C9AIHTMLCanvas methodsFor: 'tags'!
text: aString
	stream nextPutAll: aString! !

!C9AIHTMLCanvas methodsFor: 'tags'!
meta
	^ C9AIMetaTag new canvas: self! !

!C9AIHTMLCanvas methodsFor: 'tags'!
title: text
	self indent.
	stream nextPutAll: '<title>'; nextPutAll: text; nextPutAll: '</title>'; cr! !

!C9AIHTMLCanvas methodsFor: 'tags'!
link
	^ C9AILinkTag new canvas: self! !

!C9AIHTMLCanvas methodsFor: 'accessing'!
contents
	^ stream contents! !

Object subclass: #C9AIMetaTag
	instanceVariableNames: 'canvas'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIMetaTag methodsFor: 'accessing'!
canvas: aCanvas
	canvas := aCanvas! !

!C9AIMetaTag methodsFor: 'attributes'!
charset: encoding
	canvas selfClosingTag: 'meta' attributes: (Dictionary new at: 'charset' put: encoding; yourself)! !

Object subclass: #C9AILinkTag
	instanceVariableNames: 'canvas'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AILinkTag methodsFor: 'accessing'!
canvas: aCanvas
	canvas := aCanvas! !

!C9AILinkTag methodsFor: 'attributes'!
rel: relType href: url
	canvas selfClosingTag: 'link' attributes: (Dictionary new at: 'rel' put: relType; at: 'href' put: url; yourself)! !

Object subclass: #C9AIWebApplication
	instanceVariableNames: 'server port components'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIWebApplication methodsFor: 'initialization'!
initialize
	super initialize.
	port := 8080.
	components := Dictionary new! !

!C9AIWebApplication methodsFor: 'registration'!
register: componentClass at: path
	components at: path put: componentClass! !

!C9AIWebApplication methodsFor: 'server'!
start
	server := WebServer reset default.
	server listenOn: port.
	
	"Add routes for each registered component"
	components keysAndValuesDo: [:path :componentClass |
		server addService: path action: [:req |
			self handleRequest: req for: componentClass
		]
	].
	
	Transcript show: 'C9AI Web Application started on port '; show: port; cr.
	Transcript show: 'Routes: '; show: components keys; cr.
	^ server! !

!C9AIWebApplication methodsFor: 'server'!
stop
	server ifNotNil: [server destroy].
	server := nil.
	Transcript show: 'C9AI Web Application stopped'; cr! !

!C9AIWebApplication methodsFor: 'private'!
handleRequest: request for: componentClass
	| component html canvas |
	component := componentClass new.
	component request: request.
	
	canvas := C9AIHTMLCanvas new.
	component renderOn: canvas.
	
	html := canvas contents.
	request sendResponseCode: 200 content: html type: 'text/html' do: []! !

!C9AIWebApplication methodsFor: 'configuration'!
port: aPort
	port := aPort! !

!C9AIWebApplication class methodsFor: 'instance creation'!
new
	^ super new initialize! !