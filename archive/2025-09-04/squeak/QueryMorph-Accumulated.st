"=== Updated Files for Conversation Accumulation ===

File in this order:
1. ResponseMorph.st (updated - accumulates conversations)
2. QueryMorph-Connected.st (updated - reuses existing ResponseMorph)

=== Testing the Updated System ===

1. Create QueryMorph:
QueryMorph demo.

2. Send multiple queries - they should all accumulate in ONE ResponseMorph:
- Send: 'Hello AI'
- Send: 'What is 2+2'  
- Send: 'Tell me about Squeak'

3. The ResponseMorph should show:
--- Conversation 1 ---
Q: Hello AI
A: [AI response]

--- Conversation 2 ---
Q: What is 2+2
A: [AI response]

--- Conversation 3 ---
Q: Tell me about Squeak
A: [AI response]

=== Key Changes ===
- ResponseMorph now stores conversationHistory (OrderedCollection)
- QueryMorph finds existing ResponseMorph instead of creating new ones
- Each conversation gets numbered and accumulated
- Scroll through full conversation history

=== Clean Up Old ResponseMorphs ===
World submorphs 
    select: [:morph | morph isKindOf: ResponseMorph]
    thenDo: [:morph | morph delete].
"