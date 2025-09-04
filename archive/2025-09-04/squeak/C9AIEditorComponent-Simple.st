C9AIWebComponent subclass: #C9AIEditorComponent
	instanceVariableNames: 'content'
	classVariableNames: 'SharedContent'
	poolDictionaries: ''
	category: 'C9AI-Web'!

!C9AIEditorComponent class methodsFor: 'class initialization'!
initialize
	SharedContent := 'Welcome to C9AI Web Editor. Perfect Unicode rendering with live Squeak integration.'! !

!C9AIEditorComponent methodsFor: 'initialization'!
initialize
	super initialize.
	content := SharedContent ifNil: ['Default content']! !

!C9AIEditorComponent methodsFor: 'rendering'!
pageTitle
	^ 'C9AI Unicode Editor'! !

!C9AIEditorComponent methodsFor: 'rendering'!
renderHeadOn: html
	html text: '<style>body{font-family:Arial;margin:20px;background:lightblue}.container{max-width:800px;margin:0 auto}.editor{background:white;padding:20px;border-radius:5px}.toolbar{margin-bottom:10px}.btn{background:blue;color:white;border:none;padding:10px;margin:5px;cursor:pointer}.content{width:100%;min-height:200px;border:2px solid gray;padding:15px;font-size:16px}</style>'! !

!C9AIEditorComponent methodsFor: 'rendering'!
renderContentOn: html
	html divClass: 'container' content: [
		html divClass: 'editor' content: [
			html h1: 'C9AI Editor'.
			html divClass: 'toolbar' content: [
				html button: 'Save' onclick: 'save()'.
				html button: 'Load' onclick: 'load()'.
				html button: 'AI' onclick: 'ai()'.
			].
			html text: '<div class="content" contenteditable="true" id="editor">'.
			html text: content.
			html text: '</div><div id="status">Ready</div><div id="ai">AI responses here</div>'
		]
	].
	html text: '<script>
function save(){
  var t=document.getElementById("editor").innerText;
  fetch("/api/save",{method:"POST",body:JSON.stringify({content:t})});
  document.getElementById("status").innerText="Saved";
}
function load(){
  fetch("/api/content").then(function(r){return r.json()}).then(function(d){
    document.getElementById("editor").innerText=d.content;
    document.getElementById("status").innerText="Loaded";
  });
}
function ai(){
  var t=document.getElementById("editor").innerText;
  fetch("/api/ai-process",{method:"POST",body:JSON.stringify({content:t})}).then(function(r){return r.json()}).then(function(d){
    document.getElementById("ai").innerHTML="AI: "+d.response;
  });
}
</script>'! !

!C9AIEditorComponent class methodsFor: 'accessing'!
content
	^ SharedContent! !

!C9AIEditorComponent class methodsFor: 'accessing'!
content: aString
	SharedContent := aString! !