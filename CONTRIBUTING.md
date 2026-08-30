# Contributing to ResX Guard

## Repository layout

```
packages/core-ts/   Shared domain logic (parser, validation, Excel, designer)
packages/ui/      React webview UI (VS Code + Visual Studio WebView2)
apps/vscode/      VS Code extension host
apps/visualstudio/ Visual Studio VSIX + C# core port
fixtures/         Sample C# project for manual testing
test/             Vitest tests (core-ts contract)
```

## Version

Single source of truth: [`version.json`](version.json). Run `npm run sync-version` before release — it updates `apps/vscode/package.json`, `packages/core-ts/src/version.ts`, and Visual Studio `Directory.Build.props`.

## Development workflow

Work on **`dev`**. Merge to **`main`** when you want CI to publish to the VS Code Marketplace (`VSCE_PAT` secret required).

```bash
npm install
npm run sync-version
npm test
npm run build
```

### VS Code extension

```bash
npm run build -w resx-guard
npm run package -w resx-guard
```

**F5 debug:**

1. Open this repo in VS Code / Cursor
2. Press **F5** (Run Extension — sample project)
3. Extension Development Host opens `fixtures/sample-project`

### Visual Studio extension

Requires Visual Studio 2022+ with **Visual Studio extension development** workload and .NET SDK.

```bash
dotnet build apps/visualstudio/ResXGuard.sln -c Debug
dotnet test apps/visualstudio/ResXGuard.sln
```

Build UI assets for VS: `npm run build:ui` (outputs to `apps/visualstudio/ResXGuard/WebView/dist`).

**F5 debug:**

1. Open **`apps/visualstudio/ResXGuard.sln`** (not the repo root, not `ResXGuard.Core` alone).
2. In Solution Explorer, right-click **`ResXGuard`** (the VSIX project) → **Set as Startup Project**. The name must appear **bold**. Do **not** use `ResXGuard.Core` or `ResXGuard.Core.Tests` — those are class libraries and show the “Output Type of Class Library cannot be started” error.
3. Configuration: **Debug | Any CPU**.
4. **Build → Rebuild Solution** (required — generates the `.vsix` and deploys it to the experimental instance).
5. Close any already-open **Experimental Instance** windows, then press **F5** — Visual Studio opens a second instance with the extension loaded.
6. In that instance: open a solution with `.resx` files (e.g. `fixtures/sample-project`), then either:
   - **View → Other Windows → ResX Guard**, or
   - Right-click a `.resx` file in **Solution Explorer → Open with ResX Guard**

**Troubleshooting**

- Binding errors mentioning `SccCompartment`, `FrameControl`, `ResourceView`, etc. in the XAML Live Preview / Binding Failures window are **Visual Studio internal UI noise** — not from ResX Guard. Ignore them.
- If the menu still does not appear: check **Extensions → Manage Extensions → Installed (Experimental Instance)** for **ResX Guard**. If missing, run **Rebuild Solution** again and confirm `%LOCALAPPDATA%\Microsoft\VisualStudio\*Exp\Extensions\migueltavar3s\ResX Guard` exists.
- To reset a broken experimental hive: close all VS instances, delete the `*Exp` folder under `%LOCALAPPDATA%\Microsoft\VisualStudio\`, then Rebuild + F5.

Requires the **Visual Studio extension development** workload installed.

## CI secrets

| Secret | Purpose |
|--------|---------|
| `VSCE_PAT` | Publish VS Code extension to Marketplace |
| `VSIX_PAT` | Publish Visual Studio extension to Marketplace |

## Screenshots

Regenerate Marketplace screenshots (optional):

```bash
node scripts/capture-screenshots.mjs
```

## Tests

```bash
npm test                    # Vitest (core-ts + UI helpers)
dotnet test apps/visualstudio/ResXGuard.sln   # C# core port
```
