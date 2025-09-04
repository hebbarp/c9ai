#lang racket

;; C9AI - Simple AI Agent System in Racket
;; Replicating the Squeak version with proper web server

(require web-server/servlet
         web-server/servlet-env
         web-server/http/request-structs
         web-server/http/response-structs
         json)

(provide main)

;; Global state for content (like SharedContent in Squeak)
(define current-content "ನಮಸ್ಕಾರ! Welcome to C9AI Racket Edition. Perfect Unicode rendering with powerful Scheme backend.")

;; HTML generation helpers
(define (html-page title body)
  (string-append
   "<!DOCTYPE html>"
   "<html lang=\"kn\">"
   "<head>"
   "<meta charset=\"UTF-8\">"
   "<title>" title "</title>"
   "<link href=\"https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;700&display=swap\" rel=\"stylesheet\">"
   "<style>"
   "* { box-sizing: border-box; }"
   "body { font-family: 'Noto Sans Kannada', Arial, sans-serif; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); overflow: hidden; height: 100vh; }"
   
   "/* Canvas container */"
   ".canvas-container { position: relative; width: 100vw; height: 100vh; background: linear-gradient(45deg, #f0f8ff 25%, transparent 25%), linear-gradient(-45deg, #f0f8ff 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f8ff 75%), linear-gradient(-45deg, transparent 75%, #f0f8ff 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px; }"
   
   "/* Header bar */"
   ".header-bar { position: fixed; top: 0; left: 0; right: 0; background: rgba(102, 126, 234, 0.9); backdrop-filter: blur(10px); color: white; padding: 10px 20px; display: flex; align-items: center; gap: 15px; z-index: 1000; border-bottom: 2px solid rgba(255,255,255,0.2); }"
   ".logo { font-size: 20px; font-weight: bold; }"
   ".header-controls { display: flex; gap: 10px; margin-left: auto; }"
   ".header-btn { background: rgba(255,255,255,0.2); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 12px; }"
   ".header-btn:hover { background: rgba(255,255,255,0.3); }"
   
   "/* Movable panels */"
   ".panel { position: absolute; background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); min-width: 250px; min-height: 150px; }"
   ".panel-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 15px; border-radius: 12px 12px 0 0; cursor: move; display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: bold; }"
   ".panel-controls { display: flex; gap: 8px; }"
   ".panel-btn { background: rgba(255,255,255,0.2); border: none; color: white; width: 20px; height: 20px; border-radius: 4px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; }"
   ".panel-btn:hover { background: rgba(255,255,255,0.3); }"
   ".panel-content { padding: 15px; height: calc(100% - 45px); overflow: auto; }"
   
   "/* Prompt panel */"
   ".prompt-panel { top: 80px; left: 50px; width: 400px; height: 250px; }"
   ".prompt-editor { width: 100%; height: 120px; border: 2px solid #ddd; border-radius: 8px; padding: 12px; font-size: 16px; font-family: 'Noto Sans Kannada', Arial, sans-serif; resize: none; }"
   ".prompt-editor:focus { outline: none; border-color: #667eea; }"
   ".prompt-controls { display: flex; gap: 10px; margin-top: 10px; }"
   ".expand-btn { background: #28a745; }"
   ".process-btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }"
   
   "/* Response panel */"
   ".response-panel { top: 80px; right: 50px; width: 450px; height: 400px; }"
   ".response-content { background: #f8f9fa; border-radius: 8px; padding: 15px; height: 100%; overflow-y: auto; font-size: 14px; line-height: 1.6; border: 1px solid #e9ecef; }"
   
   "/* Status panel */"
   ".status-panel { bottom: 50px; left: 50px; width: 300px; height: 120px; }"
   ".status-indicator { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }"
   ".status-dot { width: 12px; height: 12px; border-radius: 50%; background: #28a745; animation: pulse 2s infinite; }"
   "@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }"
   
   "/* Resize handles */"
   ".resize-handle { position: absolute; background: #667eea; opacity: 0.3; }"
   ".resize-se { bottom: 0; right: 0; width: 15px; height: 15px; cursor: se-resize; border-radius: 12px 0 12px 0; }"
   ".resize-e { top: 15px; right: 0; width: 5px; height: calc(100% - 30px); cursor: e-resize; }"
   ".resize-s { bottom: 0; left: 15px; width: calc(100% - 30px); height: 5px; cursor: s-resize; }"
   
   "/* Utility classes */"
   ".btn { border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 14px; transition: all 0.2s ease; }"
   ".btn:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }"
   ".expanded { height: 400px !important; }"
   
   "</style>"
   "</head>"
   "<body>"
   body
   "</body>"
   "</html>"))

;; Editor component
(define (editor-component)
  (string-append
   ;; Header bar
   "<div class=\"header-bar\">"
   "<div class=\"logo\">🤖 C9AI Racket</div>"
   "<div>Perfect Unicode • Live AI • Movable Interface</div>"
   "<div class=\"header-controls\">"
   "<button class=\"header-btn\" onclick=\"resetPanels()\">Reset Layout</button>"
   "<button class=\"header-btn\" onclick=\"saveWorkspace()\">Save Layout</button>"
   "</div>"
   "</div>"
   
   ;; Canvas container
   "<div class=\"canvas-container\" id=\"canvas\">"
   
   ;; Prompt Panel
   "<div class=\"panel prompt-panel\" id=\"promptPanel\">"
   "<div class=\"panel-header\" onmousedown=\"startDrag(event, 'promptPanel')\">"
   "<span>✏️ Prompt</span>"
   "<div class=\"panel-controls\">"
   "<button class=\"panel-btn\" onclick=\"toggleExpand('promptPanel')\">⤢</button>"
   "<button class=\"panel-btn\" onclick=\"minimizePanel('promptPanel')\">−</button>"
   "</div>"
   "</div>"
   "<div class=\"panel-content\">"
   "<textarea class=\"prompt-editor\" id=\"promptEditor\" placeholder=\"Enter your prompt here...\">" current-content "</textarea>"
   "<div class=\"prompt-controls\">"
   "<button class=\"btn expand-btn\" onclick=\"expandPrompt()\">Expand</button>"
   "<button class=\"btn process-btn\" onclick=\"processWithAI()\">🤖 Process</button>"
   "<button class=\"btn\" onclick=\"saveContent()\">Save</button>"
   "</div>"
   "</div>"
   "<div class=\"resize-handle resize-se\" onmousedown=\"startResize(event, 'promptPanel', 'se')\"></div>"
   "<div class=\"resize-handle resize-e\" onmousedown=\"startResize(event, 'promptPanel', 'e')\"></div>"
   "<div class=\"resize-handle resize-s\" onmousedown=\"startResize(event, 'promptPanel', 's')\"></div>"
   "</div>"
   
   ;; Response Panel
   "<div class=\"panel response-panel\" id=\"responsePanel\">"
   "<div class=\"panel-header\" onmousedown=\"startDrag(event, 'responsePanel')\">"
   "<span>🤖 AI Response</span>"
   "<div class=\"panel-controls\">"
   "<button class=\"panel-btn\" onclick=\"clearResponse()\">🗑</button>"
   "<button class=\"panel-btn\" onclick=\"copyResponse()\">📋</button>"
   "</div>"
   "</div>"
   "<div class=\"panel-content\">"
   "<div class=\"response-content\" id=\"responseContent\">"
   "<p><em>AI responses will appear here...</em></p>"
   "<p>Try typing in the prompt panel and click 'Process' to see AI responses.</p>"
   "</div>"
   "</div>"
   "<div class=\"resize-handle resize-se\" onmousedown=\"startResize(event, 'responsePanel', 'se')\"></div>"
   "</div>"
   
   ;; Status Panel
   "<div class=\"panel status-panel\" id=\"statusPanel\">"
   "<div class=\"panel-header\" onmousedown=\"startDrag(event, 'statusPanel')\">"
   "<span>📊 Status</span>"
   "<div class=\"panel-controls\">"
   "<button class=\"panel-btn\" onclick=\"togglePanel('statusPanel')\">👁</button>"
   "</div>"
   "</div>"
   "<div class=\"panel-content\">"
   "<div class=\"status-indicator\">"
   "<div class=\"status-dot\"></div>"
   "<span id=\"statusText\">Ready</span>"
   "</div>"
   "<div id=\"connectionStatus\">🔗 Connected to Racket backend</div>"
   "<div id=\"lastAction\">💾 Last action: Page loaded</div>"
   "</div>"
   "</div>"
   
   "</div>"
   
   ;; JavaScript for drag, resize, and panel functionality
   "<script>"
   "let isDragging = false;"
   "let isResizing = false;"
   "let dragElement = null;"
   "let dragOffset = { x: 0, y: 0 };"
   "let resizeElement = null;"
   "let resizeType = null;"
   
   "// Drag functionality"
   "function startDrag(e, elementId) {"
   "  e.preventDefault();"
   "  isDragging = true;"
   "  dragElement = document.getElementById(elementId);"
   "  const rect = dragElement.getBoundingClientRect();"
   "  dragOffset.x = e.clientX - rect.left;"
   "  dragOffset.y = e.clientY - rect.top;"
   "  dragElement.style.zIndex = 1000;"
   "  updateStatus('Moving panel: ' + elementId);"
   "}"
   
   "// Resize functionality"
   "function startResize(e, elementId, type) {"
   "  e.preventDefault();"
   "  e.stopPropagation();"
   "  isResizing = true;"
   "  resizeElement = document.getElementById(elementId);"
   "  resizeType = type;"
   "  updateStatus('Resizing panel: ' + elementId);"
   "}"
   
   "// Mouse move handler"
   "document.addEventListener('mousemove', (e) => {"
   "  if (isDragging && dragElement) {"
   "    const x = e.clientX - dragOffset.x;"
   "    const y = e.clientY - dragOffset.y;"
   "    dragElement.style.left = Math.max(0, x) + 'px';"
   "    dragElement.style.top = Math.max(50, y) + 'px';"
   "  }"
   "  if (isResizing && resizeElement) {"
   "    const rect = resizeElement.getBoundingClientRect();"
   "    if (resizeType === 'se') {"
   "      resizeElement.style.width = Math.max(250, e.clientX - rect.left) + 'px';"
   "      resizeElement.style.height = Math.max(150, e.clientY - rect.top) + 'px';"
   "    } else if (resizeType === 'e') {"
   "      resizeElement.style.width = Math.max(250, e.clientX - rect.left) + 'px';"
   "    } else if (resizeType === 's') {"
   "      resizeElement.style.height = Math.max(150, e.clientY - rect.top) + 'px';"
   "    }"
   "  }"
   "});"
   
   "// Mouse up handler"
   "document.addEventListener('mouseup', () => {"
   "  if (isDragging) {"
   "    dragElement.style.zIndex = 'auto';"
   "    updateStatus('Panel moved');"
   "  }"
   "  if (isResizing) {"
   "    updateStatus('Panel resized');"
   "  }"
   "  isDragging = false;"
   "  isResizing = false;"
   "  dragElement = null;"
   "  resizeElement = null;"
   "});"
   
   "// Panel control functions"
   "function toggleExpand(panelId) {"
   "  const panel = document.getElementById(panelId);"
   "  panel.classList.toggle('expanded');"
   "  updateStatus('Toggled expansion: ' + panelId);"
   "}"
   
   "function minimizePanel(panelId) {"
   "  const panel = document.getElementById(panelId);"
   "  const content = panel.querySelector('.panel-content');"
   "  content.style.display = content.style.display === 'none' ? 'block' : 'none';"
   "  updateStatus('Minimized: ' + panelId);"
   "}"
   
   "function clearResponse() {"
   "  document.getElementById('responseContent').innerHTML = '<p><em>Response cleared</em></p>';"
   "  updateStatus('Response cleared');"
   "}"
   
   "function copyResponse() {"
   "  const responseText = document.getElementById('responseContent').innerText;"
   "  navigator.clipboard.writeText(responseText);"
   "  updateStatus('Response copied to clipboard');"
   "}"
   
   "function resetPanels() {"
   "  document.getElementById('promptPanel').style.cssText = '';"
   "  document.getElementById('responsePanel').style.cssText = '';"
   "  document.getElementById('statusPanel').style.cssText = '';"
   "  updateStatus('Layout reset');"
   "}"
   
   "// Core functionality"
   "function saveContent() {"
   "  const text = document.getElementById('promptEditor').value;"
   "  updateStatus('Saving...');"
   "  fetch('/api/save', {"
   "    method: 'POST',"
   "    headers: {'Content-Type': 'application/json'},"
   "    body: JSON.stringify({content: text})"
   "  }).then(response => response.json()).then(data => {"
   "    updateStatus('Saved to Racket backend!');"
   "  }).catch(err => {"
   "    updateStatus('Save failed');"
   "  });"
   "}"
   
   "function processWithAI() {"
   "  const text = document.getElementById('promptEditor').value;"
   "  if (!text.trim()) {"
   "    updateStatus('Please enter a prompt first');"
   "    return;"
   "  }"
   "  updateStatus('Processing with AI...');"
   "  document.getElementById('responseContent').innerHTML = '<p>🤖 <em>C9AI Racket is thinking...</em></p>';"
   "  fetch('/api/ai-process', {"
   "    method: 'POST',"
   "    headers: {'Content-Type': 'application/json'},"
   "    body: JSON.stringify({content: text})"
   "  }).then(response => response.json()).then(data => {"
   "    document.getElementById('responseContent').innerHTML = '<div style=\"background: #e8f5e8; padding: 10px; border-radius: 6px; margin-bottom: 10px;\"><strong>🤖 AI Response:</strong></div><div>' + data.response + '</div>';"
   "    updateStatus('AI processing complete');"
   "  }).catch(err => {"
   "    document.getElementById('responseContent').innerHTML = '<p style=\"color: red;\">❌ AI processing failed</p>';"
   "    updateStatus('AI processing failed');"
   "  });"
   "}"
   
   "function expandPrompt() {"
   "  toggleExpand('promptPanel');"
   "}"
   
   "// Utility functions"
   "function updateStatus(message) {"
   "  document.getElementById('statusText').textContent = message;"
   "  document.getElementById('lastAction').textContent = '💫 Last action: ' + message;"
   "  console.log('C9AI: ' + message);"
   "}"
   
   "// Initialize"
   "updateStatus('C9AI Racket interface loaded');"
   "console.log('🚀 C9AI Racket Editor with movable panels loaded!');"
   "</script>"))

;; Helper function to extract path strings
(define (extract-path-strings url-path)
  (map path/param-path url-path))

;; Main request handler
(define (start request)
  (define path-structs (url-path (request-uri request)))
  (define path-strings (extract-path-strings path-structs))
  
  (printf "Request path strings: ~a\n" path-strings)  ; Debug output
  
  (cond
    ;; Main editor page - handle root and /editor
    [(or (equal? path-strings '("")) 
         (equal? path-strings '())
         (equal? path-strings '("editor")))
     (printf "Serving editor page\n")
     (response/full
      200 #"OK"
      (current-seconds) #"text/html; charset=utf-8"
      '()
      (list (string->bytes/utf-8 (html-page "C9AI Editor" (editor-component)))))]
    
    ;; API: Get content
    [(equal? path-strings '("api" "content"))
     (printf "Serving content API\n")
     (response/full
      200 #"OK"
      (current-seconds) #"application/json; charset=utf-8"
      '()
      (list (string->bytes/utf-8 (jsexpr->string (hash 'content current-content)))))]
    
    ;; API: Save content
    [(and (equal? path-strings '("api" "save"))
          (equal? (request-method request) #"POST"))
     (printf "Serving save API\n")
     (define json-data (bytes->string/utf-8 (request-post-data/raw request)))
     (define data (string->jsexpr json-data))
     (set! current-content (hash-ref data 'content ""))
     (printf "Content saved: ~a\n" current-content)
     (response/full
      200 #"OK"
      (current-seconds) #"application/json; charset=utf-8"
      '()
      (list (string->bytes/utf-8 (jsexpr->string (hash 'status "success")))))]
    
    ;; API: AI Process
    [(and (equal? path-strings '("api" "ai-process"))
          (equal? (request-method request) #"POST"))
     (printf "Serving AI process API\n")
     (define json-data (bytes->string/utf-8 (request-post-data/raw request)))
     (define data (string->jsexpr json-data))
     (define content (hash-ref data 'content ""))
     (define ai-response (string-append "🤖 Racket AI processed: \"" 
                                       (substring content 0 (min 50 (string-length content)))
                                       "...\" - This would connect to your local/cloud AI engine."))
     (printf "AI processing: ~a\n" content)
     (response/full
      200 #"OK"
      (current-seconds) #"application/json; charset=utf-8"
      '()
      (list (string->bytes/utf-8 (jsexpr->string (hash 'response ai-response)))))]
    
    ;; 404 Not Found
    [else
     (printf "404 for path: ~a\n" path-strings)
     (response/full
      404 #"Not Found"
      (current-seconds) #"text/html"
      '()
      (list (string->bytes/utf-8 (format "<h1>404 - Not Found</h1><p>Path: ~a</p>" path-strings))))]))

;; Start the server
(define (main)
  (printf "🚀 Starting C9AI Racket Web Server...\n")
  (printf "📝 Editor: http://localhost:8080/editor\n")
  (printf "🔗 API: http://localhost:8080/api/*\n")
  (printf "🎯 Perfect Unicode • Live AI • Scheme Power\n")
  
  (serve/servlet start
                 #:servlet-path "/"
                 #:servlet-regexp #px".*"
                 #:port 8080))

;; Run the server
(main)