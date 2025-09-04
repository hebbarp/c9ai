#!/bin/bash
# Generate Interactive Unicode HTML from template
# Usage: generate-interactive-html.sh "title" "content" output.html

TITLE="$1"
CONTENT="$2"
OUTPUT="$3"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/../templates/editable-unicode-template.html"

# Check if template exists
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "Error: Interactive template file not found at $TEMPLATE_FILE"
    exit 1
fi

# Escape HTML special characters and handle newlines
escape_html() {
    echo "$1" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g'
}

# Create temporary files for safe substitution
TEMP_FILE=$(mktemp)
TITLE_FILE=$(mktemp)
CONTENT_FILE=$(mktemp)

# Write escaped content to temp files
echo "$(escape_html "$TITLE")" > "$TITLE_FILE"
echo "$(escape_html "$CONTENT")" > "$CONTENT_FILE"

# Use Python for reliable substitution with multiline content
python3 << EOF
import re

# Read template
with open('$TEMPLATE_FILE', 'r', encoding='utf-8') as f:
    template = f.read()

# Read title and content
with open('$TITLE_FILE', 'r', encoding='utf-8') as f:
    title = f.read().strip()

with open('$CONTENT_FILE', 'r', encoding='utf-8') as f:
    content = f.read().strip()

# Replace placeholders
result = template.replace('{{TITLE}}', title)
result = result.replace('{{CONTENT}}', content)

# Write result
with open('$OUTPUT', 'w', encoding='utf-8') as f:
    f.write(result)
EOF

# Clean up temp files
rm -f "$TEMP_FILE" "$TITLE_FILE" "$CONTENT_FILE"

# Check if generation was successful
if [ $? -eq 0 ]; then
    echo "Interactive Unicode HTML generated: $OUTPUT"
    # Try to open in browser
    if command -v open &> /dev/null; then
        open "$OUTPUT"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$OUTPUT"
    fi
else
    echo "Error generating interactive HTML file"
    exit 1
fi