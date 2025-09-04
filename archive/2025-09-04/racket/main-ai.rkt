#lang racket

;; C9AI with Local AI Integration - llama.cpp + Cloud AI fallback

(require web-server/servlet
         web-server/servlet-env
         web-server/http/request-structs
         web-server/http/response-structs
         json
         net/http-client
         net/uri-codec)

(provide main)

;; Global state and settings
(define current-content "ನಮಸ್ಕಾರ! C9AI with Local AI Integration. Test with local llama.cpp server!")

;; AI Connection Settings - Configured for your existing setup
(define ai-settings (make-hash))
(hash-set! ai-settings 'local-enabled #t)
(hash-set! ai-settings 'local-url "http://localhost:8080")
(hash-set! ai-settings 'local-model "phi-3-mini")
(hash-set! ai-settings 'cloud-enabled #t)
(hash-set! ai-settings 'cloud-provider "anthropic")
(hash-set! ai-settings 'cloud-api-key "")
(hash-set! ai-settings 'max-tokens 1000)
(hash-set! ai-settings 'temperature 0.7)

;; Check if local AI (llama.cpp) is available
(define (check-local-ai)
  (with-handlers ([exn:fail? (lambda (e) 
                              (printf "Local AI check failed: ~a\n" (exn-message e))
                              #f)])
    (define-values (status headers response)
      (http-sendrecv "localhost" 8080
                     "/health"
                     #:method "GET"
                     #:close? #t))
    (printf "Health check: status=~a\n" status)
    (= status 200)))

;; Call local AI (llama.cpp server) - Fixed for actual llama.cpp API
(define (call-local-ai prompt)
  (with-handlers ([exn:fail? (lambda (e) 
                              (printf "Local AI call failed: ~a\n" (exn-message e))
                              #f)])
    (define request-data 
      (jsexpr->string 
       (hash 'prompt prompt
             'n_predict (hash-ref ai-settings 'max-tokens)
             'temperature (hash-ref ai-settings 'temperature)
             'stop '()
             'stream #f)))
    
    (printf "Sending to local AI: ~a\n" request-data)
    
    (define-values (status headers response)
      (http-sendrecv "localhost" 8080
                     "/completion"
                     #:method "POST"
                     #:headers (list "Content-Type: application/json")
                     #:data request-data
                     #:close? #t))
    
    (printf "Local AI response: status=~a, response=~a\n" status response)
    
    (if (= status 200)
        (let ([data (string->jsexpr response)])
          (hash-ref data 'content "No response from local AI"))
        #f)))

;; Call cloud AI (placeholder for Anthropic/OpenAI)
(define (call-cloud-ai prompt)
  (string-append
   "🌐 **Cloud AI Response** (Placeholder)\n\n"
   "This would connect to:\n"
   "• Anthropic Claude API\n"
   "• OpenAI GPT API\n" 
   "• Google Gemini API\n\n"
   "Your prompt: \"" prompt "\"\n\n"
   "To enable cloud AI:\n"
   "1. Add your API key in settings\n"
   "2. Select your preferred provider\n"
   "3. Configure model parameters"))

;; Main AI processing with local-first approach
(define (process-ai prompt)
  (printf "=== AI Processing Started ===\n")
  (printf "Prompt: ~a\n" prompt)
  (printf "Local enabled: ~a\n" (hash-ref ai-settings 'local-enabled))
  
  (define local-available? (and (hash-ref ai-settings 'local-enabled) 
                                (check-local-ai)))
  (printf "Local available: ~a\n" local-available?)
  
  (cond
    ;; Try local AI first
    [local-available?
     (printf "Attempting local AI call...\n")
     (define local-response (call-local-ai prompt))
     (printf "Local response: ~a\n" local-response)
     (if local-response
         (string-append "🖥️ **Local AI Response (Phi-3):**\n\n" local-response)
         (if (hash-ref ai-settings 'cloud-enabled)
             (begin
               (printf "Local AI failed, trying cloud...\n")
               (call-cloud-ai prompt))
             "❌ Local AI failed and cloud AI is disabled"))]
    
    ;; Fallback to cloud AI
    [(hash-ref ai-settings 'cloud-enabled)
     (printf "Using cloud AI (local not available)...\n")
     (call-cloud-ai prompt)]
    
    ;; No AI available
    [else
     (printf "No AI available\n")
     "❌ **No AI Available**\n\nPlease:\n1. Start local llama.cpp server on port 8080\n2. Or enable and configure cloud AI\n\nCheck if your llama.cpp server is running with:\ncurl http://localhost:8080/health"]))

;; Generate settings panel HTML
(define (generate-settings-html)
  (string-append
   "<div class='settings-panel' id='settingsPanel' style='display: none;'>"
   "<h3>⚙️ AI Connection Settings</h3>"
   "<div class='setting-group'>"
   "<h4>🖥️ Local AI (llama.cpp)</h4>"
   "<label><input type='checkbox' id='localEnabled' " (if (hash-ref ai-settings 'local-enabled) "checked" "") "> Enable Local AI</label>"
   "<label>Server URL: <input type='text' id='localUrl' value='" (hash-ref ai-settings 'local-url) "'></label>"
   "<label>Model: <input type='text' id='localModel' value='" (hash-ref ai-settings 'local-model) "'></label>"
   "</div>"
   "<div class='setting-group'>"
   "<h4>🌐 Cloud AI</h4>"
   "<label><input type='checkbox' id='cloudEnabled' " (if (hash-ref ai-settings 'cloud-enabled) "checked" "") "> Enable Cloud AI</label>"
   "<label>Provider: <select id='cloudProvider'>"
   "<option value='anthropic'" (if (equal? (hash-ref ai-settings 'cloud-provider) "anthropic") " selected" "") ">Anthropic Claude</option>"
   "<option value='openai'" (if (equal? (hash-ref ai-settings 'cloud-provider) "openai") " selected" "") ">OpenAI GPT</option>"
   "<option value='google'" (if (equal? (hash-ref ai-settings 'cloud-provider) "google") " selected" "") ">Google Gemini</option>"
   "</select></label>"
   "<label>API Key: <input type='password' id='cloudApiKey' value='" (hash-ref ai-settings 'cloud-api-key) "' placeholder='Enter your API key'></label>"
   "</div>"
   "<div class='setting-group'>"
   "<h4>🎛️ Generation Parameters</h4>"
   "<label>Max Tokens: <input type='number' id='maxTokens' value='" (number->string (hash-ref ai-settings 'max-tokens)) "' min='100' max='4000'></label>"
   "<label>Temperature: <input type='range' id='temperature' value='" (number->string (hash-ref ai-settings 'temperature)) "' min='0' max='1' step='0.1'> <span id='tempValue'>" (number->string (hash-ref ai-settings 'temperature)) "</span></label>"
   "</div>"
   "<div class='controls'>"
   "<button class='btn btn-success' onclick='saveSettings()'>💾 Save Settings</button>"
   "<button class='btn' onclick='testConnections()'>🔍 Test Connections</button>"
   "<button class='btn btn-danger' onclick='closeSettings()'>❌ Close</button>"
   "</div>"
   "</div>"))

;; Generate main HTML page with AI integration
(define (ai-page)
  (define html-content
    (string-append
     "<!DOCTYPE html>"
     "<html lang='kn'>"
     "<head>"
     "<meta charset='UTF-8'>"
     "<title>C9AI - Local AI Integration</title>"
     "<link href='https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;700&display=swap' rel='stylesheet'>"
     "<style>"
     "* { box-sizing: border-box; margin: 0; padding: 0; }"
     "body { font-family: 'Noto Sans Kannada', Arial, sans-serif; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); height: 100vh; }"
     ".container { display: flex; flex-direction: column; height: 100vh; }"
     ".header { background: linear-gradient(135deg, #495057 0%, #343a40 100%); color: white; padding: 15px 20px; display: flex; align-items: center; justify-content: space-between; }"
     ".header-info { display: flex; align-items: center; gap: 15px; }"
     ".ai-status { display: flex; gap: 15px; font-size: 12px; }"
     ".ai-indicator { display: flex; align-items: center; gap: 5px; }"
     ".status-dot { width: 8px; height: 8px; border-radius: 50%; }"
     ".status-local { background: #28a745; }"
     ".status-cloud { background: #17a2b8; }"
     ".status-offline { background: #dc3545; }"
     ".workspace { display: flex; flex: 1; gap: 20px; padding: 20px; position: relative; }"
     ".panel { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid #dee2e6; }"
     ".prompt-panel { flex: 1; min-width: 400px; }"
     ".response-panel { flex: 1; min-width: 400px; }"
     ".settings-panel { position: absolute; top: 20px; right: 20px; width: 400px; background: white; border-radius: 10px; padding: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); border: 2px solid #495057; z-index: 1000; }"
     ".setting-group { margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; }"
     ".setting-group h4 { margin-bottom: 10px; color: #495057; }"
     ".setting-group label { display: block; margin-bottom: 8px; font-size: 14px; }"
     ".setting-group input, .setting-group select { width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; margin-top: 4px; }"
     ".prompt-area { width: 100%; height: 200px; border: 2px solid #ddd; border-radius: 8px; padding: 15px; font-size: 16px; font-family: inherit; resize: vertical; }"
     ".prompt-area:focus { outline: none; border-color: #495057; }"
     ".controls { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }"
     ".btn { background: linear-gradient(135deg, #495057 0%, #343a40 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 14px; transition: all 0.2s; }"
     ".btn:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(73, 80, 87, 0.3); }"
     ".btn-success { background: linear-gradient(135deg, #198754 0%, #146c43 100%); }"
     ".btn-danger { background: linear-gradient(135deg, #dc3545 0%, #b02a37 100%); }"
     ".btn-info { background: linear-gradient(135deg, #0dcaf0 0%, #0aa2c0 100%); }"
     ".response-content { background: #f8f9fa; border-radius: 8px; padding: 20px; min-height: 200px; border: 1px solid #e9ecef; font-size: 14px; line-height: 1.6; }"
     ".status { margin-top: 15px; padding: 10px; background: #d4edda; border-radius: 6px; color: #155724; font-size: 14px; }"
     "</style>"
     "</head>"
     "<body>"
     "<div class='container'>"
     "<div class='header'>"
     "<div class='header-info'>"
     "<h1>🤖 C9AI</h1>"
     "<span>Local AI Integration + Cloud Fallback</span>"
     "</div>"
     "<div class='ai-status'>"
     "<div class='ai-indicator'>"
     "<div class='status-dot status-local' id='localStatus'></div>"
     "<span>Local AI</span>"
     "</div>"
     "<div class='ai-indicator'>"
     "<div class='status-dot status-cloud' id='cloudStatus'></div>"
     "<span>Cloud AI</span>"
     "</div>"
     "<button class='btn btn-info' onclick='openSettings()'>⚙️ Settings</button>"
     "</div>"
     "</div>"
     "<div class='workspace'>"
     "<div class='panel prompt-panel'>"
     "<h3>✏️ Prompt</h3>"
     "<textarea id='promptArea' class='prompt-area' placeholder='Enter your prompt for AI processing...'>" current-content "</textarea>"
     "<div class='controls'>"
     "<button class='btn btn-success' onclick='processAI()'>🤖 Process with AI</button>"
     "<button class='btn' onclick='saveContent()'>💾 Save</button>"
     "<button class='btn btn-danger' onclick='clearPrompt()'>🗑 Clear</button>"
     "</div>"
     "</div>"
     "<div class='panel response-panel'>"
     "<h3>🤖 AI Response</h3>"
     "<div id='responseContent' class='response-content'>"
     "<p><strong>🎯 AI Integration Active!</strong></p>"
     "<p><strong>Local AI:</strong> Connected to your existing Phi model</p>"
     "<p><strong>Cloud AI:</strong> Available as fallback (configure in ⚙️ settings)</p>"
     "<p><strong>Status:</strong> Ready to process prompts with local-first approach</p>"
     "<br>"
     "<p><em>For new users installing C9AI:</em></p>"
     "<p>• Install llama.cpp and download a model</p>"
     "<p>• Start server: <code>./server -m model.gguf --port 8080</code></p>"
     "<p>• Or use cloud AI with API keys in settings ⚙️</p>"
     "</div>"
     "<div class='controls'>"
     "<button class='btn' onclick='copyResponse()'>📋 Copy</button>"
     "<button class='btn btn-danger' onclick='clearResponse()'>🗑 Clear</button>"
     "</div>"
     "</div>"
     
     ;; Settings panel
     (generate-settings-html)
     
     "</div>"
     "<div id='status' class='status'>Ready - Local AI preferred, Cloud AI fallback available</div>"
     "</div>"
     
     ;; JavaScript with AI integration
     "<script>"
     "function updateStatus(msg) {"
     "  document.getElementById('status').textContent = msg;"
     "  console.log('C9AI: ' + msg);"
     "}"
     
     "function updateConnectionStatus() {"
     "  fetch('/api/ai-status')"
     "    .then(r => r.json())"
     "    .then(data => {"
     "      document.getElementById('localStatus').className = 'status-dot ' + (data.local ? 'status-local' : 'status-offline');"
     "      document.getElementById('cloudStatus').className = 'status-dot ' + (data.cloud ? 'status-cloud' : 'status-offline');"
     "    })"
     "    .catch(() => {"
     "      document.getElementById('localStatus').className = 'status-dot status-offline';"
     "      document.getElementById('cloudStatus').className = 'status-dot status-offline';"
     "    });"
     "}"
     
     "function processAI() {"
     "  const text = document.getElementById('promptArea').value;"
     "  if (!text.trim()) {"
     "    updateStatus('Please enter a prompt first');"
     "    return;"
     "  }"
     "  updateStatus('Processing with AI (local first, cloud fallback)...');"
     "  document.getElementById('responseContent').innerHTML = '<p>🤖 <em>Connecting to AI...</em></p>';"
     "  "
     "  fetch('/api/ai-process', {"
     "    method: 'POST',"
     "    headers: {'Content-Type': 'application/json'},"
     "    body: JSON.stringify({content: text})"
     "  })"
     "  .then(r => r.json())"
     "  .then(data => {"
     "    const html = '<div style=\"background: #d4edda; padding: 15px; border-radius: 8px; margin-bottom: 15px;\"><strong>🤖 AI Response:</strong></div><div style=\"white-space: pre-wrap;\">' + data.response + '</div>';"
     "    document.getElementById('responseContent').innerHTML = html;"
     "    updateStatus('AI processing complete');"
     "    updateConnectionStatus();"
     "  })"
     "  .catch(err => {"
     "    document.getElementById('responseContent').innerHTML = '<p style=\"color: #dc3545; background: #f8d7da; padding: 15px; border-radius: 8px;\">❌ Error: ' + err.message + '</p>';"
     "    updateStatus('AI processing failed');"
     "  });"
     "}"
     
     "function openSettings() {"
     "  document.getElementById('settingsPanel').style.display = 'block';"
     "  updateStatus('Settings opened');"
     "}"
     
     "function closeSettings() {"
     "  document.getElementById('settingsPanel').style.display = 'none';"
     "  updateStatus('Settings closed');"
     "}"
     
     "function saveSettings() {"
     "  const settings = {"
     "    localEnabled: document.getElementById('localEnabled').checked,"
     "    localUrl: document.getElementById('localUrl').value,"
     "    localModel: document.getElementById('localModel').value,"
     "    cloudEnabled: document.getElementById('cloudEnabled').checked,"
     "    cloudProvider: document.getElementById('cloudProvider').value,"
     "    cloudApiKey: document.getElementById('cloudApiKey').value,"
     "    maxTokens: parseInt(document.getElementById('maxTokens').value),"
     "    temperature: parseFloat(document.getElementById('temperature').value)"
     "  };"
     "  "
     "  fetch('/api/settings', {"
     "    method: 'POST',"
     "    headers: {'Content-Type': 'application/json'},"
     "    body: JSON.stringify(settings)"
     "  })"
     "  .then(r => r.json())"
     "  .then(data => {"
     "    updateStatus('Settings saved successfully');"
     "    updateConnectionStatus();"
     "  })"
     "  .catch(err => {"
     "    updateStatus('Settings save failed');"
     "  });"
     "}"
     
     "function testConnections() {"
     "  updateStatus('Testing AI connections...');"
     "  fetch('/api/test-connections')"
     "    .then(r => r.json())"
     "    .then(data => {"
     "      updateStatus('Connection test: Local=' + (data.local ? 'OK' : 'FAIL') + ', Cloud=' + (data.cloud ? 'OK' : 'FAIL'));"
     "      updateConnectionStatus();"
     "    })"
     "    .catch(err => {"
     "      updateStatus('Connection test failed');"
     "    });"
     "}"
     
     "function saveContent() {"
     "  const text = document.getElementById('promptArea').value;"
     "  updateStatus('Saving...');"
     "  fetch('/api/save', {"
     "    method: 'POST',"
     "    headers: {'Content-Type': 'application/json'},"
     "    body: JSON.stringify({content: text})"
     "  })"
     "  .then(r => r.json())"
     "  .then(data => { updateStatus('Saved!'); })"
     "  .catch(err => { updateStatus('Save failed'); });"
     "}"
     
     "function clearPrompt() {"
     "  document.getElementById('promptArea').value = '';"
     "  updateStatus('Prompt cleared');"
     "}"
     
     "function clearResponse() {"
     "  document.getElementById('responseContent').innerHTML = '<p><em>Response cleared</em></p>';"
     "  updateStatus('Response cleared');"
     "}"
     
     "function copyResponse() {"
     "  const text = document.getElementById('responseContent').innerText;"
     "  navigator.clipboard.writeText(text).then(() => {"
     "    updateStatus('Response copied to clipboard');"
     "  }).catch(() => { updateStatus('Copy failed'); });"
     "}"
     
     "// Temperature slider update"
     "document.addEventListener('DOMContentLoaded', () => {"
     "  const tempSlider = document.getElementById('temperature');"
     "  const tempValue = document.getElementById('tempValue');"
     "  if (tempSlider && tempValue) {"
     "    tempSlider.addEventListener('input', (e) => {"
     "      tempValue.textContent = e.target.value;"
     "    });"
     "  }"
     "  updateConnectionStatus();"
     "  setInterval(updateConnectionStatus, 10000); // Check every 10 seconds"
     "});"
     
     "updateStatus('C9AI AI Integration Ready - Local first, Cloud fallback');"
     "console.log('🚀 C9AI AI Integration loaded!');"
     "</script>"
     "</body>"
     "</html>"))
  
  (response/full
   200 #"OK"
   (current-seconds) #"text/html; charset=utf-8"
   '()
   (list (string->bytes/utf-8 html-content))))

;; Helper function
(define (extract-path-strings url-path)
  (map path/param-path url-path))

;; Main request handler
(define (start request)
  (define path-structs (url-path (request-uri request)))
  (define path-strings (extract-path-strings path-structs))
  
  (printf "Request: ~a\n" path-strings)
  
  (cond
    ;; Main page
    [(or (equal? path-strings '("")) 
         (equal? path-strings '())
         (equal? path-strings '("editor")))
     (printf "Serving AI integration page\n")
     (ai-page)]
    
    ;; API: AI Status check
    [(equal? path-strings '("api" "ai-status"))
     (define local-available? (and (hash-ref ai-settings 'local-enabled) (check-local-ai)))
     (define cloud-available? (hash-ref ai-settings 'cloud-enabled))
     (response/full
      200 #"OK"
      (current-seconds) #"application/json; charset=utf-8"
      '()
      (list (string->bytes/utf-8 (jsexpr->string 
                                  (hash 'local local-available?
                                        'cloud cloud-available?)))))]
    
    ;; API: Test connections
    [(equal? path-strings '("api" "test-connections"))
     (define local-test (and (hash-ref ai-settings 'local-enabled) (check-local-ai)))
     (define cloud-test (hash-ref ai-settings 'cloud-enabled)) ; Would test actual API
     (response/full
      200 #"OK"
      (current-seconds) #"application/json; charset=utf-8"
      '()
      (list (string->bytes/utf-8 (jsexpr->string 
                                  (hash 'local local-test
                                        'cloud cloud-test)))))]
    
    ;; API: Settings
    [(and (equal? path-strings '("api" "settings"))
          (equal? (request-method request) #"POST"))
     (define json-data (bytes->string/utf-8 (request-post-data/raw request)))
     (define data (string->jsexpr json-data))
     
     ;; Update settings
     (hash-set! ai-settings 'local-enabled (hash-ref data 'localEnabled #f))
     (hash-set! ai-settings 'local-url (hash-ref data 'localUrl "http://localhost:8080"))
     (hash-set! ai-settings 'local-model (hash-ref data 'localModel "llama-3.2"))
     (hash-set! ai-settings 'cloud-enabled (hash-ref data 'cloudEnabled #f))
     (hash-set! ai-settings 'cloud-provider (hash-ref data 'cloudProvider "anthropic"))
     (hash-set! ai-settings 'cloud-api-key (hash-ref data 'cloudApiKey ""))
     (hash-set! ai-settings 'max-tokens (hash-ref data 'maxTokens 1000))
     (hash-set! ai-settings 'temperature (hash-ref data 'temperature 0.7))
     
     (printf "Settings updated\n")
     (response/full
      200 #"OK"
      (current-seconds) #"application/json; charset=utf-8"
      '()
      (list (string->bytes/utf-8 (jsexpr->string (hash 'status "success")))))]
    
    ;; API: Save content
    [(and (equal? path-strings '("api" "save"))
          (equal? (request-method request) #"POST"))
     (define json-data (bytes->string/utf-8 (request-post-data/raw request)))
     (define data (string->jsexpr json-data))
     (set! current-content (hash-ref data 'content ""))
     (printf "Saved: ~a\n" current-content)
     (response/full
      200 #"OK"
      (current-seconds) #"application/json; charset=utf-8"
      '()
      (list (string->bytes/utf-8 (jsexpr->string (hash 'status "success")))))]
    
    ;; API: AI Process - Main AI integration
    [(and (equal? path-strings '("api" "ai-process"))
          (equal? (request-method request) #"POST"))
     (define json-data (bytes->string/utf-8 (request-post-data/raw request)))
     (define data (string->jsexpr json-data))
     (define content (hash-ref data 'content ""))
     (define ai-response (process-ai content))
     (printf "AI processing: ~a\n" content)
     (response/full
      200 #"OK"
      (current-seconds) #"application/json; charset=utf-8"
      '()
      (list (string->bytes/utf-8 (jsexpr->string (hash 'response ai-response)))))]
    
    ;; 404
    [else
     (response/full
      404 #"Not Found"
      (current-seconds) #"text/html"
      '()
      (list (string->bytes/utf-8 "<h1>404 - Not Found</h1>")))]))

;; Start server
(define (main)
  (printf "🤖 Starting C9AI with AI Integration...\n")
  (printf "🔧 Features:\n")
  (printf "   • Local AI: Connecting to your existing Phi model\n")
  (printf "   • Cloud AI fallback (Anthropic/OpenAI/Google)\n")
  (printf "   • Connection settings and testing\n")
  (printf "   • Real-time status monitoring\n")
  (printf "📝 Visit: http://localhost:8085/\n")
  (printf "\n💡 For new C9AI users:\n")
  (printf "   Setup instructions available in the interface\n")
  (printf "   Local AI preferred, cloud AI as fallback\n")
  
  (serve/servlet start
                 #:servlet-path "/"
                 #:servlet-regexp #px".*"
                 #:port 8085))

(main)