This repo hosts the C9Ai agentic tool with multi ai provision. This tool helps manage tasks. Read the paper for details: /Users/hebbarp/c9ai_paper.tex

Here's what we need to do:

1. Simplify the GUI
2. Keep 8080 port for conversations and 8787 for agentic tool use
3. Make the agentic tool use gui different to hint to users that its not for conversations
4. have a way to send inputs from 8080 to 8787 through writing to a file and the agentic tool reading the file for context
5. agentic tool should use local ai (Phi2, Gemma3, llama, etc.) to run tools (programs)
6. user should be able to launch a terminal with claude cli or gemini cli if required. have buttons for these
7. all work happen through tasks file, which is either stored locally or on the web.
8. agentic tool should be able to consume apis, hit the endpoint and get results. so api settings should be there
9. agentic tool gui should respond to a query of "what tools can i run"
10. we should have a package manager kind of thing like we have now
11. python is used to write scripts where necessary
12. Bash on linux and macos, ppowershell on windows will be default script hosts. so if possible scripts should be written first in these
13. common programs like imagemagick, ffmpeg, email, pandoc, etc. should be downloaded to the user system

You can suggest some more ideas.

Let's discuss way forward.