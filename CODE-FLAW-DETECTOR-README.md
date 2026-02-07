# Code Flaw Detector Skill

A comprehensive skill for detecting security vulnerabilities, performance issues, code quality problems, and logical errors in code.

## What It Does

The Code Flaw Detector systematically analyzes code across four dimensions:

1. **Security Flaws** - SQL injection, XSS, authentication issues, hardcoded credentials, weak cryptography
2. **Performance Issues** - N+1 queries, inefficient algorithms, memory leaks, missing indexes
3. **Code Quality** - Code smells, poor naming, lack of tests, documentation gaps, anti-patterns
4. **Logical Errors** - Edge cases, race conditions, null handling, type coercion bugs, off-by-one errors

## Installation

The skill is packaged in `code-flaw-detector.skill` (located in the project root). To use it:

1. Install the skill in your AI assistant environment
2. The skill will automatically trigger when you ask for code review, security audit, bug detection, or similar requests

## Usage Examples

Trigger the skill with queries like:

- "Review this code for security issues"
- "Find bugs in this function"
- "Check for performance problems"
- "What's wrong with this code?"
- "Analyze this for vulnerabilities"
- "Detect flaws in my implementation"

## Output Format

The skill provides:

- **Summary**: Overview of findings with severity counts
- **Critical Issues**: High-impact flaws requiring immediate attention
- **High Priority**: Important but not critical issues
- **Medium/Low Priority**: Improvements and optimizations
- **Recommendations**: Actionable steps with code examples

## Reference Materials

The skill includes comprehensive reference guides:

- **security-flaws.md** - Injection attacks, XSS, authentication, cryptography, API security
- **performance-issues.md** - Database optimization, algorithm efficiency, resource management
- **code-quality.md** - Code smells, naming, error handling, testing, documentation
- **logical-errors.md** - Edge cases, race conditions, type issues, validation gaps

## Key Features

✅ Multi-language support (JavaScript, Python, Java, PHP, SQL, etc.)  
✅ Context-aware analysis (web apps, APIs, databases, business logic)  
✅ Specific fixes with code examples  
✅ Prioritized findings by severity  
✅ Covers 100+ common vulnerability patterns  
✅ Performance bottleneck detection  
✅ Code quality assessment  
✅ Edge case identification  

## Example Analysis

**Input:**
```javascript
app.get('/user/:id', (req, res) => {
  db.query('SELECT * FROM users WHERE id = ' + req.params.id);
});
```

**Output:**
```
Type: Security - SQL Injection (Critical)
Location: Route handler /user/:id
Impact: Attacker can execute arbitrary SQL commands
Fix:
app.get('/user/:id', (req, res) => {
  db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
});
```

## Skill Structure

```
code-flaw-detector/
├── SKILL.md                          # Main workflow and instructions
└── references/
    ├── security-flaws.md             # Security vulnerability patterns
    ├── performance-issues.md         # Performance anti-patterns
    ├── code-quality.md               # Maintainability issues
    └── logical-errors.md             # Logic bugs and edge cases
```

## Best Practices

The skill follows these analysis principles:

- **Be specific**: Points to exact lines/functions
- **Explain impact**: Why each flaw matters
- **Show fixes**: Provides corrected code examples
- **Prioritize ruthlessly**: Focuses on exploitable/breaking issues first
- **Consider context**: Accounts for framework protections

## License

See the skill files for licensing information.
