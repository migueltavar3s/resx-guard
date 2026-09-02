# Changelog

## 0.2.1

Internal sideload release (VS Code + Visual Studio). Not published to the Marketplace until this lands on `main`.

### Filters
- Empty filter results keep the grid header, so filters stay visible
- **Clear filters** restores the full row list in one click

### Naming
- PascalCase key warnings include a `suggestedKey`
- **Apply** in the Issues column and in Summary renames the key through the existing host action

### Issues, warnings, and errors
- An *issue* is any validation finding; *errors* are duplicate keys; *warnings* are quality checks
- Portuguese copy no longer mixes “Avisos” with “Warnings”
- Summary legend and Issues tooltips match that distinction

## 0.2.0

Marketplace release focused on Excel workflows, a safer Summary pane, and polish for publish.

### Excel import / export
- Toolbar Export/Import (remembers last action) for selected `.resx` families
- Round-trip `.xlsx` / `.xls` with English and Portuguese headers
- Skip empty trailing columns; ignore `Project`; strip BOM on headers
- Match families by display name or unique basename without greedy false matches
- Map locale casing (`PT` → `pt`), create missing satellite files, leave empty cells unchanged

### Summary & layout
- Oversized keys wrap in Summary, grid cells, and the delete dialog
- Issue cards wrap giant PascalCase tokens so the pane no longer overflows
- Chrome UI test guards a fixed-width Summary against horizontal growth

### Tooling & packaging
- GitHub Actions: tests on `dev` and on PRs; tests + Marketplace publish on push to `main`
- Marketplace gallery screenshots and refreshed extension icon

## 0.1.1

- Detect satellite cultures more reliably (`pt`, `pt-PT`, `pt_PT`, folder-based locales, `Default.aspx.pt.resx`) and skip false suffixes like `App.Web.resx`
- Read Visual Studio `.resx` files: UTF-16, full XSD schema, and `type="System.String"` entries
- Scan past 5000 files; ignore `bin`/`obj`
- Designer namespace follows project folders (`RootNamespace` + relative path), matching Visual Studio

## 0.1.0

- First public release on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=migueltavar3s.resx-guard)
- Grid editor for `.resx` families, file tree, validation, and Designer.cs sync
- English and Portuguese UI
