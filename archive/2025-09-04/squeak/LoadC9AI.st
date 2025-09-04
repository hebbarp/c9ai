"C9AI Squeak Setup Script
Load this in a Squeak workspace to set up the C9AI system"

"First, ensure we have required packages"
Transcript show: 'Setting up C9AI for Squeak...'; cr.

"Load the classes"
Transcript show: 'Loading C9AI classes...'; cr.

"You need to file-in the .st files manually in Squeak:"
Transcript show: '1. File in C9AILlamaConnector.st'; cr.
Transcript show: '2. File in C9AIMorphicUI.st'; cr.
Transcript show: '3. Then execute: C9AIMainWindow demo'; cr.

"Test the system"
Transcript show: 'To test the system:'; cr.
Transcript show: 'C9AILlamaConnector test'; cr.

"Open the main interface"
Transcript show: 'To open the GUI:'; cr.
Transcript show: 'C9AIMainWindow open'; cr.

Transcript show: 'Setup complete! 🚀'; cr.