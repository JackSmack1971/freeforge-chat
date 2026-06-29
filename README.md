# FreeForge Chat

FreeForge Chat is a zero-build browser chat UI for OpenRouter free AI models.
Open the app in a modern browser, paste an API key, and start chatting without
installing packages or running a local server.

## Quick Start

1. Get an API key from [OpenRouter](https://openrouter.ai/keys).
2. Open `freeforge/index.html` in a modern browser:
   Chrome 97+, Firefox 104+, or Safari 15.4+.
3. Paste your API key into the onboarding screen.
4. Pick a free model and start chatting.

## Features

- Streaming responses from OpenRouter-hosted free models
- Markdown rendering with DOMPurify sanitization
- Local chat history stored in the browser
- Copy, regenerate, and suggestion-chip actions in the chat UI
- Responsive single-page interface with no build step

## Project Structure

- `freeforge/index.html`: app entrypoint
- `freeforge/src/`: browser-side JavaScript modules
- `freeforge/styles/app.css`: app styling
- `netlify.toml`: static publish configuration and security headers

## Running Locally

This project does not require a package manager or build step.

1. Clone the repository.
2. Open `freeforge/index.html` directly in a supported browser.
3. Enter your OpenRouter API key when prompted.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the repo-specific workflow, commands, and review expectations.

## Deployment

The repository is preconfigured for Netlify static hosting.

- Publish directory: `freeforge`
- Config file: `netlify.toml`
- Security headers: CSP, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, and `Permissions-Policy`

To deploy on Netlify:

1. Create a new site from this repository.
2. Leave the build command empty.
3. Set the publish directory to `freeforge` if Netlify does not detect it from
   `netlify.toml`.
4. Deploy the site.

You can also host the `freeforge/` directory on any static host that serves the
HTML, CSS, and JavaScript files directly.

## Tech Stack

- Vanilla JavaScript ES modules
- Tailwind CSS via CDN
- `marked` for Markdown parsing
- DOMPurify for HTML sanitization
- Netlify for static deployment and response headers

## Runtime CDN Assets

- `marked@18.0.4` from `https://cdn.jsdelivr.net/npm/marked@18.0.4/lib/marked.umd.js`
  with `sha384-8RA8Ah4c9upJmKfg5nH01OgjZoQ3mRX+ngrKYWXQYj2dHYxFqYz8POSlii33f0wB`
- `dompurify@3.4.8` from `https://cdn.jsdelivr.net/npm/dompurify@3.4.8/dist/purify.min.js`
  with `sha384-jrsBdrv4eDpEYIq32u13DPbvB6tRmqIDnA6UlgFBoexpetaiWi7g/VbfMEL1WVen`
- `tailwindcss@3` from `https://cdn.tailwindcss.com`

## Privacy Notes

- API keys are stored in `sessionStorage`, scoped to the current browser tab
- Chat history is stored locally in the browser
- The app does not include analytics or error-tracking services
