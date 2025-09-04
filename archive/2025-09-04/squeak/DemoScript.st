"C9AI Modular Demo Script
 Load this in Squeak workspace and execute parts as needed"

"=== 1. Load the AI Client (if not already loaded) ==="
"Copy C9AI-FixedParser.st and file it in first"

"=== 2. Test AI Connection ==="
| testClient |
testClient := C9AILlamaClient new.
testClient completion: 'Hello AI, please introduce yourself briefly'.

"=== 3. Create a standalone ResponseMorph with sample data ==="
ResponseMorph demo.

"=== 4. Create a QueryMorph that spawns ResponseMorphs ==="
QueryMorph demo.

"=== 5. Position morphs nicely ==="
"Execute each line separately in workspace:"

"Create and position QueryMorph:"
QueryMorph new position: 50@100; openInWorld.

"Create and position ResponseMorph:"
(ResponseMorph new)
    position: 450@100;
    showResponse: 'What is Smalltalk' 
    answer: 'Smalltalk is a dynamic, object-oriented programming language created by Alan Kay and his team at Xerox PARC';
    openInWorld.

"=== 6. Test the connected system ==="
"Use the QueryMorph above to send a query - it should create ResponseMorphs automatically"

"=== 7. Cleanup all C9AI morphs ==="
World submorphs 
    select: [:morph | (morph isKindOf: QueryMorph) or: [morph isKindOf: ResponseMorph]]
    thenDo: [:morph | morph delete].

"=== Notes ==="
"- Drag morphs around the Squeak world
- QueryMorph creates ResponseMorphs to the right when you send queries  
- Each ResponseMorph is independent and draggable
- All communication goes through local Phi-3 model at localhost:8080
- Check Transcript window for debugging output"