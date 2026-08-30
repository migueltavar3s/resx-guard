# ResX Guard

Fast, minimalist ResX translation manager for C# projects in **Visual Studio Code** and **Visual Studio 2022/2026**.

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/migueltavar3s.resx-guard?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=migueltavar3s.resx-guard)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/migueltavar3s.resx-guard)](https://marketplace.visualstudio.com/items?itemName=migueltavar3s.resx-guard)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Inspired by Visual Studio ResX Resource Manager — spreadsheet-style grid, instant search, configurable validation, automatic `Resources.Designer.cs` updates, and Excel import/export.

**Install (VS Code):** [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=migueltavar3s.resx-guard) · ID `migueltavar3s.resx-guard`

## Screenshots

### Grid + Summary

![ResX Guard grid with Summary panel](apps/vscode/media/screenshot-grid.png)

### Validation chips and issues

![Validation issues in the grid and Summary](apps/vscode/media/screenshot-validation.png)

### Excel import / export

![Excel import and export overview](apps/vscode/media/screenshot-excel.png)

## Features

- Spreadsheet-style grid: keys × languages
- File tree with checkboxes to scope which `.resx` families appear
- Choose which language columns to show; **Summary** always lists every locale
- Fast in-memory search/filter with incremental file refresh
- Validation rules (PascalCase keys, matching string endings, placeholders, missing translations)
- Warnings in the grid, Summary, and Problems / Error List
- Auto-update `*.Designer.cs` when keys change
- Import/export Excel (`.xlsx` / `.xls`) for the selected families
- UI in **English** and **Portuguese**

## Usage

1. Open a workspace or solution that contains `.resx` files
2. **VS Code:** run **ResX Guard: Open** from the command palette, or use the Activity Bar icon
3. **Visual Studio:** open **View → Other Windows → ResX Guard**
4. Select resource families on the left, edit translations in the grid
5. Use **Export** / **Import** in the toolbar to round-trip the selected families through Excel. Empty cells on import leave existing translations unchanged.

## Settings

- **VS Code:** **ResX Guard** in Settings — key naming, Designer.cs generation, validation rules
- **Visual Studio:** **Tools → Options → ResX Guard**

## Support

If ResX Guard saves you time, consider [sponsoring on GitHub](https://github.com/sponsors/migueltavar3s).

Issues: [github.com/migueltavar3s/resx-guard/issues](https://github.com/migueltavar3s/resx-guard/issues)

See [CHANGELOG.md](CHANGELOG.md) for release notes.
