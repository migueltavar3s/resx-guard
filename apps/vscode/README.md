# ResX Guard

Fast, minimalist ResX translation manager for C# projects in **Visual Studio Code** and **Visual Studio 2022/2026**.

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/migueltavar3s.resx-guard?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=migueltavar3s.resx-guard)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/migueltavar3s.resx-guard)](https://marketplace.visualstudio.com/items?itemName=migueltavar3s.resx-guard)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Inspired by Visual Studio ResX Resource Manager — spreadsheet-style grid, instant search, configurable validation, automatic `Resources.Designer.cs` updates, and Excel import/export.

**Install (VS Code):** [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=migueltavar3s.resx-guard) · ID `migueltavar3s.resx-guard`

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

## Additional Support for JSON (i18n)

While ResX Guard is primarily designed as a core tool for C# `.resx` XML files, it also offers **additional support** for nested JSON translation files (commonly used in web frontend workflows).

**Considerations and Limitations:**
- **File Structure Requirement:** JSON files must be located directly inside a folder named after a valid language locale code (e.g., `locales/en/translation.json`, `locales/pt/translation.json`).
- **Namespacing:** The filename (e.g., `translation`) acts as the resource namespace family.
- **Flattened Keys:** Nested JSON objects are automatically flattened into dot-notation keys (e.g., `navigation.dashboard`) for grid editing, and correctly unflattened back to deeply nested JSON upon saving.
- **Comments:** Standard JSON does not support comments, so the comment field is disabled when editing these files.
- **File Types:** The workspace scanner looks for both `.json` and `.i18n` file extensions inside valid locale folders.

*Note: This is provided as a quality-of-life feature to bridge frontend web translations and C# backend `.resx` workflows in the same editor, but it is not intended to support all arbitrary i18n JSON structures.*

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
