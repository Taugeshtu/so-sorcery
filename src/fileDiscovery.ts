import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

interface GitIgnoreRule {
  pattern: string;
  isNegation: boolean;
  isDirectory: boolean;
  repoRoot: string;
}

export async function getFilteredFilePaths(): Promise<string[]> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return [];
  }

  const exts = vscode.workspace.getConfiguration('sorcery')
    .get<string[]>('includeFileExtensions') || [];
  
  try {
    // Find all .gitignore files and their repo roots
    const gitIgnoreRules = await loadAllGitIgnoreRules(folder.uri.fsPath);
    
    // Walk filesystem and apply filters
    const allFiles = await walkDirectory(
      folder.uri.fsPath, 
      folder.uri.fsPath, 
      exts, 
      gitIgnoreRules
    );
    
    return allFiles.sort();
  } catch (error) {
    console.error('File discovery failed:', error);
    return [];
  }
}

async function loadAllGitIgnoreRules(rootPath: string): Promise<GitIgnoreRule[]> {
  const rules: GitIgnoreRule[] = [];
  
  // Always load custom ignore patterns from configuration
  const customPatterns = vscode.workspace.getConfiguration('sorcery')
    .get<string[]>('customIgnorePatterns') || [];
  
  for (const pattern of customPatterns) {
    if (pattern.trim()) {
      const isNegation = pattern.startsWith('!');
      let cleanPattern = isNegation ? pattern.substring(1) : pattern;
      const isDirectory = cleanPattern.endsWith('/');
      if (isDirectory) {
        cleanPattern = cleanPattern.substring(0, cleanPattern.length - 1);
      }
      
      rules.push({
        pattern: cleanPattern,
        isNegation,
        isDirectory,
        repoRoot: rootPath // Use workspace root as repo root for custom patterns
      });
    }
  }
  
  // Find all .gitignore files recursively
  const gitIgnoreFiles = await findGitIgnoreFiles(rootPath);
  
  for (const gitIgnoreFile of gitIgnoreFiles) {
    const repoRoot = path.dirname(gitIgnoreFile);
    const gitIgnoreRules = await parseGitIgnoreFile(gitIgnoreFile, repoRoot);
    rules.push(...gitIgnoreRules);
  }
  
  return rules;
}

async function findGitIgnoreFiles(rootPath: string): Promise<string[]> {
  const gitIgnoreFiles: string[] = [];
  
  const walkForGitIgnore = async (dirPath: string) => {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip common non-repo directories to avoid deep recursion
          if (!['node_modules', '.git', 'build', 'dist', 'out'].includes(entry.name)) {
            await walkForGitIgnore(fullPath);
          }
        } else if (entry.name === '.gitignore') {
          gitIgnoreFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.warn(`Cannot read directory ${dirPath}:`, error);
    }
  };
  
  await walkForGitIgnore(rootPath);
  return gitIgnoreFiles;
}

async function parseGitIgnoreFile(gitIgnoreFile: string, repoRoot: string): Promise<GitIgnoreRule[]> {
  try {
    const content = await fs.promises.readFile(gitIgnoreFile, 'utf8');
    const rules: GitIgnoreRule[] = [];
    
    for (let line of content.split(/\r?\n/)) {
      line = line.trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        continue;
      }
      
      const isNegation = line.startsWith('!');
      if (isNegation) {
        line = line.substring(1);
      }
      
      const isDirectory = line.endsWith('/');
      if (isDirectory) {
        line = line.substring(0, line.length - 1);
      }
      
      rules.push({
        pattern: line,
        isNegation,
        isDirectory,
        repoRoot
      });
    }
    
    return rules;
  } catch (error) {
    console.warn(`Failed to parse .gitignore file ${gitIgnoreFile}:`, error);
    return [];
  }
}

async function walkDirectory(
  dirPath: string, 
  workspaceRoot: string, 
  extensions: string[], 
  gitIgnoreRules: GitIgnoreRule[]
): Promise<string[]> {
  const files: string[] = [];
  
  const walkRecursive = async (currentPath: string) => {
    try {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(workspaceRoot, fullPath);
        
        // Skip .git directories entirely
        if (entry.name === '.git') {
          continue;
        }
        
        if (entry.isDirectory()) {
          // Check if directory should be ignored AND has no negation rules
          const dirIgnored = isIgnored(relativePath + '/', gitIgnoreRules, workspaceRoot, true);
          const hasNegations = hasNegationRulesForPath(relativePath, gitIgnoreRules);
          
          // Recurse if directory is not ignored OR if it has potential negation rules
          if (!dirIgnored || hasNegations) {
            await walkRecursive(fullPath);
          }
        } else if (entry.isFile()) {
          // Check file extension
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            // Check if file should be ignored
            if (!isIgnored(relativePath, gitIgnoreRules, workspaceRoot, false)) {
              files.push(relativePath);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Cannot read directory ${currentPath}:`, error);
    }
  };
  
  await walkRecursive(dirPath);
  return files;
}

function isIgnored(
  filePath: string, 
  gitIgnoreRules: GitIgnoreRule[], 
  workspaceRoot: string,
  isDirectory: boolean
): boolean {
  let ignored = false;
  
  // Convert to forward slashes for consistent matching
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  for (const rule of gitIgnoreRules) {
    // Check if this rule applies to this file's location
    const fileFullPath = path.resolve(workspaceRoot, filePath);
    const ruleApplies = fileFullPath.startsWith(rule.repoRoot);
    
    if (!ruleApplies) {
      continue;
    }
    
    // Get path relative to this rule's repo root
    const pathFromRepoRoot = path.relative(rule.repoRoot, fileFullPath).replace(/\\/g, '/');
    
    if (matchesGitIgnorePattern(pathFromRepoRoot, rule.pattern, rule.isDirectory, isDirectory)) {
      ignored = !rule.isNegation; // Negation rules un-ignore, normal rules ignore
    }
  }
  
  return ignored;
}

function hasNegationRulesForPath(dirPath: string, gitIgnoreRules: GitIgnoreRule[]): boolean {
  const normalizedDirPath = dirPath.replace(/\\/g, '/');
  
  return gitIgnoreRules.some(rule => {
    if (!rule.isNegation) return false;
    
    // Check if this negation rule could apply to files in this directory
    const rulePattern = rule.pattern.replace(/\\/g, '/');
    
    // If the negation pattern starts with or contains this directory path
    return rulePattern.startsWith(normalizedDirPath) || 
           simpleGlobMatch(normalizedDirPath, rulePattern.split('/')[0]);
  });
}

function matchesGitIgnorePattern(filePath: string, pattern: string, ruleIsDirectory: boolean, fileIsDirectory: boolean): boolean {
  // Convert gitignore pattern to regex-like matching
  // This is a simplified version - full gitignore matching is quite complex
  
  // Handle absolute patterns (starting with /)
  if (pattern.startsWith('/')) {
    pattern = pattern.substring(1);
    // Match from root only
    return matchesPattern(filePath, pattern, ruleIsDirectory, fileIsDirectory);
  }
  
  // Try matching the pattern against the full path
  if (matchesPattern(filePath, pattern, ruleIsDirectory, fileIsDirectory)) {
    return true;
  }
  
  // Handle patterns that should match anywhere in the path
  const pathParts = filePath.split('/');
  
  // Try matching against each path segment and its trailing path
  for (let i = 0; i < pathParts.length; i++) {
    const subPath = pathParts.slice(i).join('/');
    if (matchesPattern(subPath, pattern, ruleIsDirectory, fileIsDirectory)) {
      return true;
    }
  }
  
  return false;
}

function matchesPattern(filePath: string, pattern: string, ruleIsDirectory: boolean, fileIsDirectory: boolean): boolean {
  // If rule is for a directory and target is a file, check if file is inside the directory
  if (ruleIsDirectory && !fileIsDirectory) {
    return filePath.startsWith(pattern + '/') || simpleGlobMatch(filePath, pattern);
  }
  
  // Standard glob matching
  return simpleGlobMatch(filePath, pattern);
}

function simpleGlobMatch(text: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // This is simplified - doesn't handle all gitignore edge cases
  const regexPattern = pattern
    .replace(/\./g, '\\.')  // Escape dots
    .replace(/\*/g, '[^/]*') // * matches anything except /
    .replace(/\?/g, '[^/]')  // ? matches single char except /
    .replace(/\\\*\\\*/g, '.*'); // ** matches anything including /
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(text);
}