/**
 * Debug utility functions - enhanced debugging for Node.js/Express
 */

/**
 * Dump and Die - Debug helper function
 * Shows debug info in browser and stops execution (throws exception)
 * Similar to Laravel's dd() function
 * Automatically detects Express response object from global context
 *
 * @param {...any} data - Variables to dump
 */
function dd(...data) {
  // Check if any argument is an Express response object
  let responseObject = null;
  let debugData = [];

  // Look for response object in arguments
  for (let i = 0; i < data.length; i++) {
    const arg = data[i];
    // Check for Express response object characteristics
    if (arg && typeof arg === 'object' &&
        typeof arg.send === 'function' &&
        typeof arg.setHeader === 'function' &&
        typeof arg.status === 'function') {
      responseObject = arg;
      // Remove response object from debug data
      debugData = data.filter((_, index) => index !== i);
      break;
    }
  }

  // If no response object found in arguments, check global context
  if (!responseObject && global._currentResponse) {
    responseObject = global._currentResponse;
    debugData = data; // Use all data since res wasn't in arguments
  }

  // If no response object found, use all data for console output
  if (!responseObject) {
    debugData = data;
  }

  // If we have a response object, render HTML
  if (responseObject) {
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Debug Output</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
            background: #0d1117;
            padding: 20px;
            font-size: 13px;
            line-height: 1.5;
            color: #c9d1d9;
        }
        .dd-container {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 6px;
            margin-bottom: 20px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .dd-header {
            background: #21262d;
            border-bottom: 1px solid #30363d;
            padding: 12px 16px;
            font-weight: 600;
            color: #c9d1d9;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .dd-body {
            padding: 16px;
            overflow-x: auto;
        }
        .dd-type {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .type-array { background: #1f6feb; color: #79c0ff; }
        .type-object { background: #bb8009; color: #f0c455; }
        .type-string { background: #1a7f37; color: #7ee787; }
        .type-number { background: #8957e5; color: #d2a8ff; }
        .type-boolean { background: #bf3989; color: #f778ba; }
        .type-null { background: #6e7681; color: #8b949e; }
        .dd-property {
            margin: 4px 0;
            padding-left: 20px;
            position: relative;
        }
        .dd-property:before {
            content: '';
            position: absolute;
            left: 6px;
            top: 12px;
            width: 8px;
            height: 1px;
            background: #30363d;
        }
        .dd-key {
            color: #ff7b72;
            font-weight: 600;
        }
        .dd-arrow {
            color: #8b949e;
            margin: 0 4px;
        }
        .dd-value {
            display: inline;
        }
        .dd-string {
            color: #a5d6ff;
        }
        .dd-string:before,
        .dd-string:after {
            content: '"';
            color: #6e7681;
        }
        .dd-number {
            color: #79c0ff;
            font-weight: 500;
        }
        .dd-boolean {
            color: #d2a8ff;
            font-weight: 600;
        }
        .dd-null {
            color: #8b949e;
            font-style: italic;
        }
        .dd-nested {
            margin-left: 16px;
            border-left: 2px solid #30363d;
            padding-left: 12px;
            margin-top: 4px;
        }
        .dd-nested.collapsed {
            display: none;
        }
        .dd-bracket {
            color: #8b949e;
            font-weight: bold;
        }
        .dd-count {
            color: #6e7681;
            font-size: 11px;
            margin-left: 4px;
        }
        .dd-toggle {
            display: inline-block;
            cursor: pointer;
            user-select: none;
            color: #58a6ff;
            margin-right: 4px;
            font-weight: bold;
            transition: transform 0.2s;
        }
        .dd-toggle:hover {
            color: #79c0ff;
        }
        .dd-toggle.collapsed {
            transform: rotate(-90deg);
        }
        .dd-footer {
            background: #21262d;
            border-top: 1px solid #30363d;
            padding: 12px 16px;
            text-align: center;
            color: #8b949e;
            font-size: 12px;
        }
    </style>
</head>
<body>
`;

    collapseId = 0; // Reset collapse ID counter
    debugData.forEach((item, index) => {
      const typeInfo = getTypeInfo(item);
      const label = debugData.length > 1 ? `Variable #${index + 1}` : 'Debug Output';

      html += `
    <div class="dd-container">
        <div class="dd-header">
            <span>${label}</span>
            <span class="dd-type type-${typeInfo.type}">${typeInfo.label}</span>
        </div>
        <div class="dd-body">
            ${formatForLaravel(item, 0)}
        </div>
    </div>
`;
    });

    html += `
    <div class="dd-footer">
        Execution stopped by dd() • Remove dd() calls before production
    </div>
    <script>
        function toggleCollapse(id) {
            const nested = document.getElementById('nested-' + id);
            const toggle = document.getElementById('toggle-' + id);
            if (nested && toggle) {
                nested.classList.toggle('collapsed');
                toggle.classList.toggle('collapsed');
            }
        }
    </script>
</body>
</html>`;

    // Send HTML response
    responseObject.setHeader('Content-Type', 'text/html');
    responseObject.send(html);

    // Throw a special exception to stop execution
    throw new Error('DEBUG_CONTINUE_EXCEPTION');
  }

  // Console output (fallback if no response object)
  console.log('\n🔍 DEBUG OUTPUT (Dump and Die)');
  console.log('=' .repeat(50));

  debugData.forEach((item, index) => {
    if (debugData.length > 1) {
      console.log(`\n📋 Argument ${index + 1}:`);
    }

    // Use console.dir for objects to show full structure
    if (typeof item === 'object' && item !== null) {
      console.dir(item, {
        depth: null, // Show all nested levels
        colors: true, // Use colors in terminal
        maxArrayLength: null, // Show all array elements
        maxStringLength: null // Show full strings
      });
    } else {
      console.log(item);
    }
  });

  console.log('\n' + '='.repeat(50));
  console.log('🛑 Execution stopped by dd()');
  console.log('Remove dd() calls before production!\n');
}

/**
 * Get type information for a value
 */
function getTypeInfo(data) {
  if (data === null) {
    return { type: 'null', label: 'null' };
  }
  if (data === undefined) {
    return { type: 'null', label: 'undefined' };
  }
  if (Array.isArray(data)) {
    return { type: 'array', label: `array (${data.length})` };
  }
  if (data instanceof Date) {
    return { type: 'object', label: 'Date' };
  }
  if (Buffer.isBuffer(data)) {
    return { type: 'object', label: 'Buffer' };
  }
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    return { type: 'object', label: `object (${keys.length})` };
  }
  if (typeof data === 'string') {
    return { type: 'string', label: `string (${data.length})` };
  }
  if (typeof data === 'number') {
    return { type: 'number', label: 'number' };
  }
  if (typeof data === 'boolean') {
    return { type: 'boolean', label: 'boolean' };
  }
  return { type: 'null', label: typeof data };
}

/**
 * Format data for Laravel-style HTML display
 */
let collapseId = 0;
function formatForLaravel(data, depth = 0, maxDepth = 10) {
  if (depth > maxDepth) {
    return '<span class="dd-null">[Max depth reached]</span>';
  }

  // Handle null
  if (data === null) {
    return '<span class="dd-null">null</span>';
  }

  // Handle undefined
  if (data === undefined) {
    return '<span class="dd-null">undefined</span>';
  }

  // Handle boolean
  if (typeof data === 'boolean') {
    return `<span class="dd-boolean">${data}</span>`;
  }

  // Handle number
  if (typeof data === 'number') {
    return `<span class="dd-number">${data}</span>`;
  }

  // Handle string
  if (typeof data === 'string') {
    const escaped = data.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="dd-string">${escaped}</span>`;
  }

  // Handle Date
  if (data instanceof Date) {
    return `<span class="dd-string">${data.toISOString()}</span>`;
  }

  // Handle Buffer
  if (Buffer.isBuffer(data)) {
    return `<span class="dd-null">Buffer(${data.length} bytes)</span>`;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '<span class="dd-bracket">[]</span>';
    }

    const currentId = collapseId++;
    let html = '<div class="dd-value dd-collapsible">';
    html += `<span class="dd-toggle" id="toggle-${currentId}" onclick="toggleCollapse(${currentId})">▼</span>`;
    html += '<span class="dd-bracket">[</span>';
    html += `<span class="dd-count">(${data.length} items)</span>`;
    html += `<div class="dd-nested" id="nested-${currentId}">`;

    data.forEach((item, index) => {
      html += '<div class="dd-property">';
      html += `<span class="dd-key">${index}</span>`;
      html += '<span class="dd-arrow">→</span>';
      html += formatForLaravel(item, depth + 1, maxDepth);
      html += '</div>';
    });

    html += '</div>';
    html += '<span class="dd-bracket">]</span>';
    html += '</div>';
    return html;
  }

  // Handle objects
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    
    if (keys.length === 0) {
      return '<span class="dd-bracket">{}</span>';
    }

    const currentId = collapseId++;
    let html = '<div class="dd-value dd-collapsible">';
    html += `<span class="dd-toggle" id="toggle-${currentId}" onclick="toggleCollapse(${currentId})">▼</span>`;
    html += '<span class="dd-bracket">{</span>';
    html += `<span class="dd-count">(${keys.length} properties)</span>`;
    html += `<div class="dd-nested" id="nested-${currentId}">`;

    keys.forEach(key => {
      html += '<div class="dd-property">';
      html += `<span class="dd-key">${key}</span>`;
      html += '<span class="dd-arrow">→</span>';
      html += formatForLaravel(data[key], depth + 1, maxDepth);
      html += '</div>';
    });

    html += '</div>';
    html += '<span class="dd-bracket">}</span>';
    html += '</div>';
    return html;
  }

  return String(data);
}

/**
 * Format data for HTML display with syntax highlighting (deprecated)
 */
function formatForHtml(data) {
  // Legacy function - now uses formatForLaravel
  return formatForLaravel(data);
}

/**
 * Dump only - Debug helper function
 * Similar to Laravel's dump() function
 * Dumps the provided data but continues execution
 *
 * @param {...any} data - Variables to dump
 */
function dump(...data) {
  console.log('\n🔍 DEBUG OUTPUT (Dump only)');
  console.log('-'.repeat(30));

  data.forEach((item, index) => {
    if (data.length > 1) {
      console.log(`\n📋 Argument ${index + 1}:`);
    }

    if (typeof item === 'object' && item !== null) {
      console.dir(item, {
        depth: 3, // Limit depth for dump (vs dd)
        colors: true,
        maxArrayLength: 10,
        maxStringLength: 500
      });
    } else {
      console.log(item);
    }
  });

  console.log('-'.repeat(30));
}

/**
 * Pretty print JSON - Useful for API responses
 *
 * @param {any} data - Data to pretty print
 */
function pp(data) {
  console.log('\n📄 PRETTY PRINT:');
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Log with timestamp - Enhanced logging
 *
 * @param {string} message - Message to log
 * @param {any} data - Optional data to log
 */
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);

  if (data !== null) {
    if (typeof data === 'object') {
      console.dir(data, { depth: 2, colors: true });
    } else {
      console.log(data);
    }
  }
}

module.exports = {
  dd,
  dump,
  pp,
  log
};