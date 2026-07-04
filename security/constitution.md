{
  "version": 1,
  "purpose": "Security constitution for FreeForge Chat writer agents.",
  "rules": [
    {
      "id": "render-assistant-html-safely",
      "vulnerability_class": "XSS / sanitizer bypass",
      "cwe": ["CWE-79", "CWE-116"],
      "owasp": ["A03:2021 Injection"],
      "must": [
        "Render assistant markdown through marked before DOMPurify.",
        "Assign only DOMPurify output to innerHTML."
      ],
      "must_not": [
        "Insert raw model or user content into innerHTML.",
        "Bypass DOMPurify for markdown rendering."
      ]
    },
    {
      "id": "keep-api-key-out-of-persistent-storage",
      "vulnerability_class": "Sensitive data exposure",
      "cwe": ["CWE-922", "CWE-312"],
      "owasp": ["A02:2021 Cryptographic Failures"],
      "must": [
        "Store the OpenRouter API key in sessionStorage only.",
        "Clear the key from persistent storage on logout or reset flows."
      ],
      "must_not": [
        "Write the API key to localStorage, indexedDB, logs, or exports.",
        "Persist secrets in committed source files."
      ]
    },
    {
      "id": "preserve-csp-and-subresource-integrity",
      "vulnerability_class": "Content Security Policy / supply-chain integrity",
      "cwe": ["CWE-693", "CWE-494"],
      "owasp": ["A05:2021 Security Misconfiguration"],
      "must": [
        "Keep the script-src policy pinned to explicit hashes or self-hosted assets.",
        "Keep third-party scripts behind checked integrity metadata."
      ],
      "must_not": [
        "Introduce wildcard script sources or unsafe-inline allowances.",
        "Load third-party code without integrity controls."
      ]
    },
    {
      "id": "validate-untrusted-structured-data",
      "vulnerability_class": "Deserialization / schema trust boundary",
      "cwe": ["CWE-502"],
      "owasp": ["A08:2021 Software and Data Integrity Failures"],
      "must": [
        "Treat untrusted JSON and API payloads as hostile until validated.",
        "Parse and normalize before storing or rendering structured data."
      ],
      "must_not": [
        "Treat remote JSON as trusted application state without validation.",
        "Execute or instantiate untrusted serialized data."
      ]
    }
  ]
}
