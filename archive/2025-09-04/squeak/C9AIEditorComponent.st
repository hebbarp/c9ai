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
	html text: '<style>
		body { font-family: Arial, sans-serif; margin: 0; background: lightblue; }
		.container { max-width: 1000px; margin: 0 auto; padding: 20px; }
		.header { background: white; border-radius: 10px; padding: 30px; text-align: center; margin-bottom: 20px; }
		.editor-panel { background: white; border-radius: 10px; padding: 30px; }
		.toolbar { display: flex; gap: 10px; margin-bottom: 20px; }
		.btn { background: blue; color: white; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer; }
		.content-editor { width: 100%; min-height: 300px; border: 2px solid gray; border-radius: 5px; padding: 20px; font-size: 16px; }
		.status { margin-left: auto; padding: 8px 16px; background: lightgreen; border-radius: 15px; font-size: 14px; }
		.ai-panel { background: lightgray; border-radius: 5px; padding: 20px; margin-top: 20px; }
	</style>'! !

!C9AIEditorComponent methodsFor: 'rendering'!
renderContentOn: html
	html divClass: 'container' content: [
		self renderHeaderOn: html.
		self renderEditorOn: html.
		self renderAIPanelOn: html
	]! !

!C9AIEditorComponent methodsFor: 'rendering'!
renderHeaderOn: html
	html divClass: 'header' content: [
		html h1: 'C9AI Unicode Editor'.
		html p: 'Live Squeak Integration with Perfect Unicode and AI Power'
	]! !

!C9AIEditorComponent methodsFor: 'rendering'!
renderEditorOn: html
	html divClass: 'editor-panel' content: [
		html divClass: 'toolbar' content: [
			html button: 'Save' onclick: 'saveContent()'.
			html button: 'Reload' onclick: 'reloadContent()'.
			html button: 'AI Process' onclick: 'processWithAI()'.
			html button: 'Copy' onclick: 'copyContent()'.
			html text: '<div class="status" id="status">Ready for editing</div>'
		].
		
		html text: '<div class="content-editor" contenteditable="true" id="editor">'.
		html text: content.
		html text: '</div>'
	].
	
	self renderJavaScriptOn: html! !

!C9AIEditorComponent methodsFor: 'rendering'!
renderAIPanelOn: html
	html divClass: 'ai-panel' content: [
		html h2: 'AI Assistant'.
		html p: 'Your content will be processed by C9AI local engine with cloud verification.'.
		html text: '<div id="ai-response">AI responses will appear here...</div>'
	]! !

!C9AIEditorComponent methodsFor: 'rendering'!
renderJavaScriptOn: html
	html text: '<script>
		const editor = document.getElementById("editor");
		const status = document.getElementById("status");
		const aiResponse = document.getElementById("ai-response");
		
		let saveTimeout;
		
		// Auto-save functionality
		editor.addEventListener("input", function() {
			clearTimeout(saveTimeout);
			status.textContent = "Editing...";
			status.style.background = "#fff3cd";
			
			saveTimeout = setTimeout(() => {
				saveContent(true);
			}, 2000);
		});
		
		function saveContent(isAutoSave = false) {
			const text = editor.innerText;
			status.textContent = isAutoSave ? "Auto-saving..." : "Saving...";
			
			fetch("/api/save", {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify({content: text})
			}).then(response => {
				if (response.ok) {
					status.textContent = isAutoSave ? "Auto-saved" : "Saved!";
					status.style.background = "#e8f5e8";
				} else {
					status.textContent = "Save failed";
					status.style.background = "#f8d7da";
				}
			}).catch(() => {
				status.textContent = "Save error";
				status.style.background = "#f8d7da";
			});
		}
		
		function reloadContent() {
			status.textContent = "Loading...";
			
			fetch("/api/content")
				.then(response => response.json())
				.then(data => {
					editor.innerText = data.content;
					status.textContent = "Reloaded";
					status.style.background = "#e8f5e8";
				});
		}
		
		function processWithAI() {
			const text = editor.innerText;
			status.textContent = "Processing with AI...";
			aiResponse.textContent = "🤖 C9AI is thinking...";
			
			fetch("/api/ai-process", {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify({content: text})
			}).then(response => response.json())
			.then(data => {
				status.textContent = "AI processing complete";
				status.style.background = "#e8f5e8";
				aiResponse.innerHTML = "🤖 <strong>AI Response:</strong><br>" + data.response;
			}).catch(() => {
				status.textContent = "AI processing failed";
				aiResponse.textContent = "AI service unavailable";
			});
		}
		
		function copyContent() {
			navigator.clipboard.writeText(editor.innerText).then(() => {
				status.textContent = "Copied to clipboard!";
				status.style.background = "#e8f5e8";
			});
		}
		
		// Keyboard shortcuts
		document.addEventListener("keydown", function(e) {
			if (e.ctrlKey || e.metaKey) {
				switch(e.key) {
					case "s":
						e.preventDefault();
						saveContent();
						break;
					case "r":
						e.preventDefault();
						reloadContent();
						break;
				}
			}
		});
		
		console.log("C9AI Editor loaded - Squeak backend active");
	</script>'! !

!C9AIEditorComponent class methodsFor: 'accessing'!
content
	^ SharedContent! !

!C9AIEditorComponent class methodsFor: 'accessing'!
content: aString
	SharedContent := aString! !