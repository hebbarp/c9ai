const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class KnowledgeScanner {
    constructor() {
        this.supportedExtensions = ['.md', '.txt', '.rst', '.json', '.js', '.py', '.go', '.java', '.cpp', '.c', '.ts'];
        this.knowledgeBase = { topics: {}, fallbacks: {} };
        this.scanStats = {
            filesScanned: 0,
            topicsExtracted: 0,
            directories: 0
        };
    }

    async scanDirectories(directories, options = {}) {
        console.log(chalk.cyan('🔍 Starting knowledge base scan...'));
        
        const {
            includeCode = true,
            includeDocs = true,
            includeReadmes = true,
            maxDepth = 3,
            ignorePatterns = ['node_modules', '.git', 'dist', 'build', '.DS_Store']
        } = options;

        for (const dir of directories) {
            if (await fs.exists(dir)) {
                console.log(chalk.gray(`📁 Scanning: ${dir}`));
                await this.scanDirectory(dir, 0, maxDepth, ignorePatterns, {
                    includeCode, includeDocs, includeReadmes
                });
            } else {
                console.log(chalk.yellow(`⚠️  Directory not found: ${dir}`));
            }
        }

        await this.processExtractedContent();
        return this.knowledgeBase;
    }

    async scanDirectory(dirPath, currentDepth, maxDepth, ignorePatterns, options) {
        if (currentDepth > maxDepth) return;

        try {
            const items = await fs.readdir(dirPath);
            this.scanStats.directories++;

            for (const item of items) {
                if (ignorePatterns.some(pattern => item.includes(pattern))) continue;

                const itemPath = path.join(dirPath, item);
                const stats = await fs.stat(itemPath);

                if (stats.isDirectory()) {
                    await this.scanDirectory(itemPath, currentDepth + 1, maxDepth, ignorePatterns, options);
                } else if (stats.isFile()) {
                    await this.scanFile(itemPath, options);
                }
            }
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Error scanning ${dirPath}: ${error.message}`));
        }
    }

    async scanFile(filePath, options) {
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath).toLowerCase();
        
        try {
            // Determine if we should scan this file
            const shouldScan = 
                (options.includeReadmes && fileName.includes('readme')) ||
                (options.includeDocs && ['.md', '.txt', '.rst'].includes(ext)) ||
                (options.includeCode && this.supportedExtensions.includes(ext));

            if (!shouldScan) return;

            const content = await fs.readFile(filePath, 'utf8');
            this.scanStats.filesScanned++;

            // Extract knowledge based on file type
            if (fileName.includes('readme')) {
                await this.extractFromReadme(filePath, content);
            } else if (ext === '.md') {
                await this.extractFromMarkdown(filePath, content);
            } else if (['.js', '.py', '.ts', '.go', '.java'].includes(ext)) {
                await this.extractFromCode(filePath, content, ext);
            } else if (ext === '.json' && fileName.includes('package')) {
                await this.extractFromPackageJson(filePath, content);
            }

        } catch (error) {
            // Skip files that can't be read (binary, permissions, etc.)
            if (error.code !== 'EISDIR' && error.code !== 'EACCES') {
                console.log(chalk.gray(`⚠️  Could not read ${filePath}: ${error.message}`));
            }
        }
    }

    async extractFromReadme(filePath, content) {
        const projectName = this.extractProjectName(filePath);
        if (!projectName) return;

        const topic = projectName.toLowerCase().replace(/[-_]/g, ' ');
        
        // Extract description (usually first paragraph after title)
        const lines = content.split('\n').filter(line => line.trim());
        let description = '';
        let features = [];
        let examples = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip title lines
            if (line.startsWith('#')) {
                if (line.toLowerCase().includes('feature') || line.toLowerCase().includes('what')) {
                    // Next few lines might be features
                    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                        const featureLine = lines[j].trim();
                        if (featureLine.startsWith('-') || featureLine.startsWith('*')) {
                            features.push(featureLine.substring(1).trim());
                        } else if (featureLine.startsWith('#')) {
                            break;
                        }
                    }
                }
                continue;
            }
            
            // Get first substantial paragraph as description
            if (!description && line.length > 50 && !line.startsWith('```')) {
                description = line;
            }
            
            // Extract code examples
            if (line.startsWith('```') && i + 1 < lines.length) {
                const exampleLines = [];
                for (let j = i + 1; j < lines.length; j++) {
                    if (lines[j].trim().startsWith('```')) break;
                    exampleLines.push(lines[j]);
                }
                if (exampleLines.length > 0 && exampleLines.length < 10) {
                    examples.push(exampleLines.join('\n').trim());
                }
            }
        }

        if (description) {
            this.addTopicKnowledge(topic, {
                definition: description,
                trends: `Based on project analysis: active development with ${features.length} key features`,
                perspectives: `Open source project with community contributions. Project focuses on ${topic} implementation.`,
                examples: examples.length > 0 ? examples.join(' | ') : `Implementation examples available in ${path.basename(path.dirname(filePath))} project`,
                source: filePath
            });
        }
    }

    async extractFromMarkdown(filePath, content) {
        const fileName = path.basename(filePath, '.md').toLowerCase();
        const topic = fileName.replace(/[-_]/g, ' ');
        
        // Extract headings and content
        const lines = content.split('\n');
        let currentSection = '';
        let sections = {};
        
        for (const line of lines) {
            if (line.startsWith('#')) {
                currentSection = line.replace(/^#+\s*/, '').toLowerCase();
                sections[currentSection] = '';
            } else if (currentSection && line.trim()) {
                sections[currentSection] += line + ' ';
            }
        }
        
        // Try to map sections to knowledge categories
        const definition = sections.overview || sections.introduction || sections.description || 
                          Object.values(sections)[0]?.substring(0, 200) || '';
        
        if (definition.length > 30) {
            this.addTopicKnowledge(topic, {
                definition: definition.trim(),
                trends: sections.trends || sections.updates || sections.changelog || 'Documentation maintained and updated regularly',
                perspectives: sections.considerations || sections.notes || 'Various implementation approaches documented',
                examples: sections.examples || sections.usage || sections.demo || 'Examples and usage patterns available in documentation',
                source: filePath
            });
        }
    }

    async extractFromCode(filePath, content, ext) {
        // Extract from comments and documentation
        const comments = this.extractComments(content, ext);
        const fileName = path.basename(filePath, ext).toLowerCase();
        
        if (comments.length === 0) return;
        
        // Look for substantial comment blocks
        const docComments = comments.filter(comment => comment.length > 100);
        if (docComments.length === 0) return;
        
        const topic = fileName.replace(/[-_]/g, ' ');
        const definition = docComments[0].substring(0, 300);
        
        this.addTopicKnowledge(topic, {
            definition: definition,
            trends: `Active ${ext.substring(1)} development with inline documentation`,
            perspectives: `Technical implementation in ${ext.substring(1)} programming language`,
            examples: `Code examples available in ${path.basename(filePath)}`,
            source: filePath
        });
    }

    async extractFromPackageJson(filePath, content) {
        try {
            const pkg = JSON.parse(content);
            if (!pkg.name || !pkg.description) return;
            
            const topic = pkg.name.replace(/[@\-_]/g, ' ').toLowerCase();
            
            this.addTopicKnowledge(topic, {
                definition: pkg.description,
                trends: `NPM package with ${Object.keys(pkg.dependencies || {}).length} dependencies`,
                perspectives: `JavaScript/Node.js package for ${topic} functionality`,
                examples: pkg.scripts ? `Available scripts: ${Object.keys(pkg.scripts).join(', ')}` : 'Package implementation available',
                source: filePath
            });
        } catch (error) {
            // Invalid JSON, skip
        }
    }

    extractComments(content, ext) {
        const comments = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (ext === '.js' || ext === '.ts') {
                // Single line comments
                if (line.startsWith('//')) {
                    comments.push(line.substring(2).trim());
                }
                // Multi-line comments
                if (line.includes('/*')) {
                    let comment = '';
                    let j = i;
                    while (j < lines.length && !lines[j].includes('*/')) {
                        comment += lines[j].replace(/\/\*|\*\/|\*/g, '').trim() + ' ';
                        j++;
                    }
                    if (j < lines.length) {
                        comment += lines[j].replace(/\/\*|\*\/|\*/g, '').trim();
                    }
                    comments.push(comment.trim());
                    i = j;
                }
            } else if (ext === '.py') {
                if (line.startsWith('#')) {
                    comments.push(line.substring(1).trim());
                }
                // Docstrings
                if (line.includes('"""') || line.includes("'''")) {
                    let comment = '';
                    let j = i;
                    const quote = line.includes('"""') ? '"""' : "'''";
                    while (j < lines.length && (j === i || !lines[j].includes(quote))) {
                        comment += lines[j].replace(new RegExp(quote, 'g'), '').trim() + ' ';
                        j++;
                    }
                    comments.push(comment.trim());
                    i = j;
                }
            }
        }
        
        return comments.filter(c => c.length > 10);
    }

    extractProjectName(filePath) {
        const parts = filePath.split(path.sep);
        // Look for project directory (usually parent of readme)
        for (let i = parts.length - 2; i >= 0; i--) {
            const part = parts[i];
            if (part && !['src', 'docs', 'doc', 'documentation'].includes(part.toLowerCase())) {
                return part;
            }
        }
        return null;
    }

    addTopicKnowledge(topic, knowledge) {
        if (!this.knowledgeBase.topics[topic]) {
            this.knowledgeBase.topics[topic] = knowledge;
            this.scanStats.topicsExtracted++;
            console.log(chalk.gray(`📝 Extracted: ${topic}`));
        }
    }

    async processExtractedContent() {
        // Add fallback responses
        this.knowledgeBase.fallbacks = {
            definition: "${topic} is a concept identified in your local codebase and documentation.",
            trends: "Based on local analysis: actively maintained with documentation and code examples.",
            perspectives: "Multiple implementation approaches found in your local projects and documentation.",
            examples: "Examples and usage patterns identified in your local files and projects."
        };

        console.log(chalk.green(`\n✅ Knowledge extraction complete:`));
        console.log(chalk.white(`   📁 Directories scanned: ${this.scanStats.directories}`));
        console.log(chalk.white(`   📄 Files processed: ${this.scanStats.filesScanned}`));
        console.log(chalk.white(`   🧠 Topics extracted: ${this.scanStats.topicsExtracted}`));
    }

    async saveKnowledgeBase(outputPath) {
        await fs.writeJson(outputPath, this.knowledgeBase, { spaces: 2 });
        console.log(chalk.green(`💾 Knowledge base saved to: ${outputPath}`));
    }
}

module.exports = KnowledgeScanner;