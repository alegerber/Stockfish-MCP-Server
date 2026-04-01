# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email **Alexander Gerber** at the address listed on the [GitHub profile](https://github.com/alegerber) with:

- A description of the vulnerability
- Steps to reproduce the issue
- Any potential impact assessment

You can expect an initial response within **72 hours**. Once the issue is confirmed, a fix will be prioritized and released as soon as possible.

## Security Considerations

### Engine Process Execution

This server spawns Stockfish and optionally Lc0 as child processes. The binary paths are controlled via environment variables (`STOCKFISH_PATH`, `LC0_PATH`). Ensure these point to trusted binaries.

### Input Validation

All tool inputs (FEN strings, PGN, move lists) are validated using Zod schemas before being passed to the chess engines. However, as with any server that accepts external input, keep the server up to date and review configurations regularly.

### Docker Deployment

When running via Docker, the server operates in an isolated container. This is the recommended deployment method for production use. Avoid mounting unnecessary host directories into the container.

### Environment Variables

Environment variables are used for configuration only (engine paths, thread counts, hash sizes). No secrets or credentials are required. Avoid exposing the container's environment to untrusted users.
