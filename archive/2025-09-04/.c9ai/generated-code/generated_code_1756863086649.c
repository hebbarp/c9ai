#include <stdio.h>

int main() {
    // The string to write
    const char *message = "Hello from C9AI";

    // Open the file for appending
    FILE *file = fopen("output.txt", "a");

    // Check if the file was opened successfully
    if (file == NULL) {
        perror("Error opening file");
        return 1;
    }

    // Write the message to the file
    if (fputs(message, file) == EOF) {
        perror("Error writing to file");
        fclose(file);
        return 1;
    }

    // Close the file
    fclose(file);

    return 0;
}