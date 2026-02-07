/**
 * Debug utility functions - similar to Laravel's dd() (dump and die)
 */

/**
 * Dump and Die - Debug helper function
 * Similar to Laravel's dd() function
 * Dumps the provided data and stops execution
 * Automatically detects web context and outputs HTML or console
 *
 * @param {...any} data - Variables to dump (last can be Express res object)
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
    <title>Debug Output - Dump and Die</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            background: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .debug-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border: 2px solid #e74c3c;
            border-radius: 8px;
            overflow: hidden;
        }
        .debug-header {
            background: #e74c3c;
            color: white;
            padding: 15px;
            margin: 0;
            font-size: 18px;
            font-weight: bold;
        }
        .debug-content {
            padding: 20px;
            border-top: 1px solid #eee;
        }
        .debug-item {
            margin-bottom: 30px;
            padding: 15px;
            background: #f8f9fa;
            border-left: 4px solid #007bff;
            border-radius: 4px;
        }
        .debug-label {
            font-weight: bold;
            color: #495057;
            margin-bottom: 10px;
            font-size: 14px;
        }
        .debug-data {
            background: #ffffff;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.4;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-height: 400px;
            overflow-y: auto;
        }
        .debug-warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            margin-top: 20px;
            border-radius: 4px;
            text-align: center;
            font-weight: bold;
        }
        .object-key { color: #007bff; }
        .object-string { color: #28a745; }
        .object-number { color: #fd7e14; }
        .object-boolean { color: #6f42c1; }
        .object-null { color: #6c757d; font-style: italic; }
    </style>
</head>
<body>
    <div class="debug-container">
        <h1 class="debug-header">🔍 Debug Output - Dump and Die</h1>
        <div class="debug-content">
`;

    debugData.forEach((item, index) => {
      const label = debugData.length > 1 ? `Argument ${index + 1}` : 'Debug Data';
      const formattedData = formatForHtml(item);

      html += `
            <div class="debug-item">
                <div class="debug-label">📋 ${label}:</div>
                <div class="debug-data">${formattedData}</div>
            </div>
`;
    });

    html += `
            <div class="debug-warning">
                ⚠️  Execution stopped by dd()<br>
                Remove dd() calls before production!
            </div>
        </div>
    </div>
</body>
</html>`;

    // Send HTML response and stop execution
    responseObject.setHeader('Content-Type', 'text/html');
    responseObject.send(html);
    process.exit(0);
  }

  // Console output (original behavior)
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
  console.log('💀 Execution stopped by dd()');
  console.log('Remove dd() calls before production!\n');

  // Stop execution
  process.exit(0);
}

/**
 * Dump and Continue - Debug helper function
 * Similar to dd() but continues execution
 * Shows debug info in browser without stopping the server
 *
 * @param {Object} res - Express response object
 * @param {...any} data - Variables to dump
 */
function dc(res, ...data) {
  let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Debug Output - Dump and Continue</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            background: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .debug-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border: 2px solid #28a745;
            border-radius: 8px;
            overflow: hidden;
        }
        .debug-header {
            background: #28a745;
            color: white;
            padding: 15px;
            margin: 0;
            font-size: 18px;
            font-weight: bold;
        }
        .debug-content {
            padding: 20px;
            border-top: 1px solid #eee;
        }
        .debug-item {
            margin-bottom: 30px;
            padding: 15px;
            background: #f8f9fa;
            border-left: 4px solid #007bff;
            border-radius: 4px;
        }
        .debug-label {
            font-weight: bold;
            color: #495057;
            margin-bottom: 10px;
            font-size: 14px;
        }
        .debug-data {
            background: #ffffff;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.4;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-height: 400px;
            overflow-y: auto;
        }
        .debug-warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            margin-top: 20px;
            border-radius: 4px;
            text-align: center;
            font-weight: bold;
        }
        .continue-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            margin-top: 10px;
        }
        .continue-btn:hover {
            background: #0056b3;
        }
        .object-key { color: #007bff; }
        .object-string { color: #28a745; }
        .object-number { color: #fd7e14; }
        .object-boolean { color: #6f42c1; }
        .object-null { color: #6c757d; font-style: italic; }
    </style>
</head>
<body>
    <div class="debug-container">
        <h1 class="debug-header">🔍 Debug Output - Dump and Continue</h1>
        <div class="debug-content">
`;

  data.forEach((item, index) => {
    const label = data.length > 1 ? `Argument ${index + 1}` : 'Debug Data';
    const formattedData = formatForHtml(item);

    html += `
            <div class="debug-item">
                <div class="debug-label">📋 ${label}:</div>
                <div class="debug-data">${formattedData}</div>
            </div>
`;
  });

  html += `
            <div class="debug-warning">
                ✅ Execution continues after debugging<br>
                <a href="javascript:history.back()" class="continue-btn">← Go Back</a>
            </div>
        </div>
    </div>
</body>
</html>`;

  // Send HTML response
  res.setHeader('Content-Type', 'text/html');
  res.send(html);

  // Throw a special exception to stop execution
  throw new Error('DEBUG_CONTINUE_EXCEPTION');
}

/**
 * Format data for HTML display with syntax highlighting
 */
function formatForHtml(data) {
  if (data === null) {
    return '<span class="object-null">null</span>';
  }

  if (typeof data === 'undefined') {
    return '<span class="object-null">undefined</span>';
  }

  if (typeof data === 'boolean') {
    return `<span class="object-boolean">${data}</span>`;
  }

  if (typeof data === 'number') {
    return `<span class="object-number">${data}</span>`;
  }

  if (typeof data === 'string') {
    return `<span class="object-string">"${data.replace(/"/g, '\\"')}"</span>`;
  }

  if (Array.isArray(data)) {
    let html = '[\n';
    data.forEach((item, index) => {
      html += `  ${formatForHtml(item)}`;
      if (index < data.length - 1) html += ',';
      html += '\n';
    });
    html += ']';
    return html;
  }

  if (typeof data === 'object') {
    let html = '{\n';
    const keys = Object.keys(data);
    keys.forEach((key, index) => {
      html += `  <span class="object-key">"${key}"</span>: ${formatForHtml(data[key])}`;
      if (index < keys.length - 1) html += ',';
      html += '\n';
    });
    html += '}';
    return html;
  }

  return String(data);
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
  dc,
  dump,
  pp,
  log
};