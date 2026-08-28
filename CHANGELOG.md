# Changelog

## 0.2.0

- Restore Excel import/export (toolbar remembers last action)
- GitHub Actions: tests on `dev`, tests + Marketplace publish on `main`

## 0.1.1

- Detect satellite cultures more reliably (`pt`, `pt-PT`, `pt_PT`, folder-based locales, `Default.aspx.pt.resx`) and skip false suffixes like `App.Web.resx`
- Read Visual Studio `.resx` files: UTF-16, full XSD schema, and `type="System.String"` entries
- Scan past 5000 files; ignore `bin`/`obj`
- Designer namespace follows project folders (`RootNamespace` + relative path), matching Visual Studio

## 0.1.0

- First public release on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=migueltavar3s.resx-guard)
- Grid editor for `.resx` families, file tree, validation, and Designer.cs sync
- English and Portuguese UI
