# VS Code Configuration

This directory contains shared VS Code configurations for all contributors.

## Files

### `tasks.json`
Defines automated tasks that run in VS Code:
- **Start Dev Server**: Automatically runs `npm run dev` when opening the dev container
- Configured to run on folder open for dev container users

### `extensions.json`
Recommends VS Code extensions for this project:
- Dev Containers - for containerized development
- ESLint & Prettier - for code formatting and linting
- Tailwind CSS - for CSS IntelliSense
- Prisma - for schema editing
- Docker - for container management

When you open the project, VS Code will prompt you to install these recommended extensions.

### `settings.json`
Shared workspace settings:
- Auto-format on save with Prettier
- ESLint auto-fix on save
- Excludes build artifacts from file explorer and search
- Configures TypeScript to use workspace version

## Why These Are Committed

These configurations:
1. Solve real workflow issues (like the dev server auto-start)
2. Ensure consistent formatting across all contributors
3. Improve the contributor experience
4. Are project-specific, not personal preferences

## Personal Settings

For personal preferences (theme, font size, etc.), use your **User Settings** instead of modifying these workspace settings.
