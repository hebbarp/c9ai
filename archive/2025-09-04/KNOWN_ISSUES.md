# Known Issues - C9AI

## 🔴 Critical Issues

### 1. Local AI Conversation Mode - Fallback Only
**Issue**: Local AI model defaults to "fallback mode" with hardcoded responses instead of using actual LLM for conversations.

**Impact**: 
- Conversations like `@conv what do you think about AI taking jobs` return generic, repetitive responses
- Defeats the purpose of having local AI capabilities
- Poor user experience for conversational interactions

**Current Behavior**:
```
c9ai> what do you think of ai
💬 Conversation mode: "what do you think of ai"  
🤖 Great question! I enjoy having conversations like this.

c9ai> well ai taking jobs, do you feel guilty?
💬 Conversation mode: "well ai taking jobs, do you feel guilty?"
🤖 I appreciate you sharing that with me. What else is on your mind?
```

**Root Cause**: 
- Local model initialization always sets `fallbackMode: true`
- `runLocalAIForConversation()` bypasses actual LLM session
- Pattern matching responses are hardcoded and generic

**Workaround**: 
- Use `@claude <message>` or `@gemini <message>` for real AI conversation
- System correctly suggests this when in fallback mode

**Files Affected**:
- `src/c9ai-core.js:1490` - fallbackMode setting
- `src/c9ai-core.js:3435-3437` - conversation handling
- `src/c9ai-core.js:3518-3528` - hardcoded responses

**Priority**: HIGH - Core functionality issue affecting user experience

---

## 🟡 Medium Issues

### 2. Content Creation Working But Could Be Enhanced
**Status**: ✅ FIXED - Now uses proper tool system instead of trying to open non-existent files

### 3. @conv Sigil Detection 
**Status**: ✅ FIXED - Sigil parsing works correctly

---

## 📋 Technical Debt

### Excessive Hardcoded Responses
**Issue**: Multiple layers of fallback responses create code bloat
- `getSimpleConversationalResponse()` - 5 generic responses
- `getEnhancedConversationalResponse()` - 40+ lines of pattern matching
- Should be replaced with actual AI conversation once LLM loading is fixed

### Next Steps
1. **Priority 1**: Fix local LLM initialization to avoid fallback mode
2. **Priority 2**: Remove hardcoded conversation patterns once real AI works
3. **Priority 3**: Implement proper conversation context/memory

---

*Last Updated: 2025-08-05*
*Workshop Demo Status: Use @claude/@gemini for conversations, local AI works for commands*