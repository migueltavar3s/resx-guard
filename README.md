# ResX Guard

Fast, minimalist ResX translation manager for C# projects in Visual Studio Code.

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/migueltavar3s.resx-guard?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=migueltavar3s.resx-guard)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/migueltavar3s.resx-guard)](https://marketplace.visualstudio.com/items?itemName=migueltavar3s.resx-guard)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Inspired by Visual Studio ResX Resource Manager — spreadsheet-style grid, instant search, configurable validation, and automatic `Resources.Designer.cs` updates.

**Install:** [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=migueltavar3s.resx-guard) · ID `migueltavar3s.resx-guard`

## Features

- Spreadsheet-style grid: keys × languages
- File tree with checkboxes to scope which `.resx` families appear
- Choose which language columns to show; **Summary** always lists every locale
- Fast in-memory search/filter
- Validation rules (PascalCase keys, matching string endings, placeholders, missing translations)
- Warnings in the grid, Summary, and VS Code Problems panel
- Auto-update `*.Designer.cs` when keys change
- Extension UI in **English** and **Portuguese**

## Usage

1. Open a workspace that contains `.resx` files
2. Run **ResX Guard: Open** from the command palette, or use the Activity Bar icon
3. Select resource families on the left, edit translations in the grid

## Settings

See **ResX Guard** in VS Code Settings for key naming, Designer.cs generation, and validation rules.

## Support

If ResX Guard saves you time, consider [sponsoring on GitHub](https://github.com/sponsors/migueltavar3s).

Issues: [github.com/migueltavar3s/resx-guard/issues](https://github.com/migueltavar3s/resx-guard/issues)

## Development

```bash
npm install
npm run build
npm test
```

### Test the UI (one step)

1. Open this repo in VS Code / Cursor
2. Press **F5** (or Run and Debug → **Run Extension (sample project)**)
3. A new Extension Development Host window opens with `fixtures/sample-project`
4. The ResX Guard panel should open automatically with Neutral + `pt` columns

In the left tree, check/uncheck `Resources` / `Messages` to filter. Click a row to see **Summary** with all languages.

Package a VSIX with `npm run package`.
