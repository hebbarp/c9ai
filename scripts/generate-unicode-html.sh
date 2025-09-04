#!/bin/bash
# Generate Unicode HTML from template
# Usage: generate-unicode-html.sh "title" "content" output.html

TITLE="$1"
CONTENT="$2"
OUTPUT="$3"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/../templates/unicode-template.html"

# Check if template exists
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "Error: Template file not found at $TEMPLATE_FILE"
    exit 1
fi

# Escape HTML special characters in content
escape_html() {
    echo "$1" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g'
}

# Escape title and content
ESCAPED_TITLE=$(escape_html "$TITLE")
ESCAPED_CONTENT=$(escape_html "$CONTENT")

# Generate HTML by replacing placeholders
sed "s/{{TITLE}}/$ESCAPED_TITLE/g; s/{{CONTENT}}/$ESCAPED_CONTENT/g" "$TEMPLATE_FILE" > "$OUTPUT"

# Check if generation was successful
if [ $? -eq 0 ]; then
    echo "Unicode HTML generated: $OUTPUT"
    # Try to open in browser
    if command -v open &> /dev/null; then
        open "$OUTPUT"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$OUTPUT"
    fi
else
    echo "Error generating HTML file"
    exit 1
fi