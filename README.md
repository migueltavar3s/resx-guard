# ResX Guard

Fast, minimalist ResX translation manager for C# projects in Visual Studio Code.

Inspired by Visual Studio ResX Resource Manager — modern VS Code UI, instant search, configurable validation rules, and automatic `Resources.Designer.cs` updates.

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

## Development

```bash
npm install
npm run build
npm test
```

Press **F5** to launch the Extension Development Host with the sample fixture project.

## Settings

See **ResX Guard** in VS Code Settings for key naming, Designer.cs generation, and validation rules.
