const vscode = acquireVsCodeApi();

function toggleSection(sectionId) {
  const content = document.getElementById(sectionId + '-content');
  const arrow = document.getElementById(sectionId + '-arrow');
  
  if (content.classList.contains('collapsed')) {
    content.classList.remove('collapsed');
    arrow.classList.remove('collapsed');
    content.style.maxHeight = content.scrollHeight + 'px';
  } else {
    content.classList.add('collapsed');
    arrow.classList.add('collapsed');
    content.style.maxHeight = '0';
  }
}

// ... rest of your JS ...