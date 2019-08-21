import * as vscode from 'vscode';
import * as os from 'os';
import { phiColors } from 'phi-colors';

export module FramePhiColors
{
    const applicationKey = "framePhiColors";

    class Config<valueT>
    {
        public constructor
        (
            public name: string,
            public defaultValue: valueT,
            public validator?: (value: valueT) => boolean,
            public minValue?: valueT,
            public maxValue?: valueT
        )
        {

        }

        regulate = (rawKey: string, value: valueT): valueT =>
        {
            let result = value;
            if (this.validator && !this.validator(result))
            {
                // settings.json をテキストとして直接編集してる時はともかく GUI での編集時に無駄にエラー表示が行われてしまうので、エンドユーザーに対するエラー表示は行わない。
                //vscode.window.showErrorMessage(`${rawKey} setting value is invalid! Please check your settings.`);
                console.error(`${rawKey} setting value is invalid! Please check your settings.`);
                result = this.defaultValue;
            }
            else
            {
                if (undefined !== this.minValue && result < this.minValue)
                {
                    result = this.minValue;
                }
                else
                if (undefined !== this.maxValue && this.maxValue < result)
                {
                    result = this.maxValue;
                }
            }
            return result;
        }

        cache: valueT | undefined;
        rawGet = (): valueT => this.cache = this.regulate
        (
            `${applicationKey}.${this.name}`,
            vscode.workspace.getConfiguration(applicationKey).get(this.name, this.defaultValue)
        )
        public get = () => undefined !== this.cache ? this.cache: this.rawGet();
        public clear = () => this.cache = undefined;
        public update = () => this.cache !== this.rawGet();
    }
    const colorValidator = (value: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(value);
    const makeEnumValidator = (valueList: string[]): (value: string) => boolean => (value: string): boolean => 0 <= valueList.indexOf(value);
    const colorModeObject = Object.freeze({ "none": null, "hostname": null, "workspace": null, "workspace-folder": null, "document": null, "file-type": null, });
    type colorMode = keyof typeof colorModeObject;
    const colorModeValidator = makeEnumValidator(Object.keys(colorModeObject));

    const titleBarColorMode = new Config<colorMode>("titleColorMode", "workspace", colorModeValidator);
    const activityBarColorMode = new Config<colorMode>("activityBarColorMode", "hostname", colorModeValidator);
    const statusBarColorMode = new Config<colorMode>("statusBarColorMode", "workspace-folder", colorModeValidator);
    const baseColor = new Config("baseColor", "#5679C9", colorValidator);

    export const initialize = (context: vscode.ExtensionContext): void =>
    {
        console.log('Congratulations, your extension "frame-phi-colors" is now active!');

        context.subscriptions.push
        (
            vscode.commands.registerCommand
            (
                'extension.helloWorld', () =>
                {
                    vscode.window.showInformationMessage('Hello World!');
                }
            ),

            //  イベントリスナーの登録
            vscode.workspace.onDidChangeConfiguration
            (
                () =>
                {
                    if
                    (
                        [
                            titleBarColorMode,
                            activityBarColorMode,
                            statusBarColorMode,
                            baseColor,
                        ]
                        .map(i => i.update())
                        .reduce((a, b) => a || b)
                    )
                    {
                        apply();
                    }
                }
            ),
            vscode.workspace.onDidChangeWorkspaceFolders(() => apply()),
            vscode.workspace.onDidChangeTextDocument(() => apply()),
        );

        apply();
    };

    const hash = (source: string): number =>
        source.split("").map(i => i.codePointAt(0) || 0).reduce((a, b) => (a *173 +b +((a & 0x5555) >>> 5)) & 8191)
        %34; // ← 通常、こういうところの数字は素数にすることが望ましいがここについては https://wraith13.github.io/phi-ratio-coloring/phi-ratio-coloring.htm で類似色の出てくる周期をベース(8,13,21,...)に調整すること。

    let rootWorkspaceFolder: vscode.WorkspaceFolder | undefined;
    const getWorkspaceUri = () => rootWorkspaceFolder ? rootWorkspaceFolder.uri: null;
    let currentWorkspaceFolder: vscode.WorkspaceFolder | undefined;
    const getWorkspaceFolderUri = () => currentWorkspaceFolder ? currentWorkspaceFolder.uri: null;
    const getDocumentUri = () => vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.uri: null;
    const getFileType = () => vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.uri.toString().replace(/.*(\.[^\.]*)/, "$1"): null;

    const getHostNameHash = (): number => hash(os.hostname());
    const getWorkspaceHash = (): number => hash(`${getWorkspaceUri()}`);
    const getWorkspaceFolderHash = (): number => hash(`${getWorkspaceFolderUri()}`);
    const getDocumentHash = (): number => hash(`${getDocumentUri()}`);
    const getHashSourceByMode = (mode: colorMode): vscode.Uri | string | null =>
    {
        switch(mode)
        {
        case "none":
            return null;
        case "hostname":
            return os.hostname();
        case "workspace":
            return getWorkspaceUri();
        case "workspace-folder":
            return getWorkspaceFolderUri();
        case "document":
            return getDocumentUri();
        case "file-type":
            return getFileType();
        }
    };
    const generateHueIndex = (source : vscode.Uri | string | null) => null === source ? null: hash(`${source}`);
    const generateHueIndexByMode = (mode: colorMode) => generateHueIndex(getHashSourceByMode(mode));
    const generateBackgroundColor = (baseColor: string, hue: number, saturation: number, lightness: number) => phiColors.generate
    (
        phiColors.rgbaToHsla(phiColors.rgbaFromStyle(baseColor)),
        hue,
        saturation,
        lightness,
        0
    );
    const generateForegroundColor = (backgroundColor: phiColors.Hsla) => phiColors.generate
    (
        backgroundColor,
        0,
        0,
        backgroundColor.l < (phiColors.HslHMin +phiColors.HslLMax) /2 ? 3: -3,
        0
    );

    const applyConfig = (config: vscode.WorkspaceConfiguration, mode: colorMode, key: string, value: string) =>
    {
    };
    const applyColor = (config: vscode.WorkspaceConfiguration, mode: colorMode, foregroundKey: string, backgroundKey: string, backgroundColor: phiColors.Hsla) =>
    {
        applyConfig(config, mode, foregroundKey, phiColors.rgbForStyle(phiColors.hslaToRgba(generateForegroundColor(backgroundColor))));
        applyConfig(config, mode, backgroundKey, phiColors.rgbForStyle(phiColors.hslaToRgba(backgroundColor)));
    };

    const apply = () =>
    {
        rootWorkspaceFolder = vscode.workspace.workspaceFolders && 0 < vscode.workspace.workspaceFolders.length ?
            vscode.workspace.workspaceFolders[0]:
            undefined;

        currentWorkspaceFolder =
            (
                vscode.window.activeTextEditor ?
                    vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri):
                    undefined
            )
            || rootWorkspaceFolder;

        const config = vscode.workspace.getConfiguration("workbench.colorCustomizations");

        const baseColorValue = baseColor.get();
        applyColor
        (
            config,
            titleBarColorMode.get(),
            "titleBar.foreground",
            "titleBar.background",
            generateBackgroundColor(baseColorValue, generateHueIndexByMode(titleBarColorMode.get()), 0, 0)
        );
        applyColor
        (
            config,
            activityBarColorMode.get(),
            "activityBar.foreground",
            "activityBar.background",
            generateBackgroundColor(baseColorValue, generateHueIndexByMode(activityBarColorMode.get()), 0, 0)
        );
        applyColor
        (
            config,
            activityBarColorMode.get(),
            "activityBarBadge.foreground",
            "activityBar.inactiveForeground",
            "activityBarBadge.background",
            generateBackgroundColor(baseColorValue, generateHueIndexByMode(activityBarColorMode.get()) +1.0, 0, 0)
        );
        applyColor
        (
            config,
            statusBarColorMode.get(),
            "statusBar.foreground",
            "statusBar.background",
            generateBackgroundColor(baseColorValue, generateHueIndexByMode(statusBarColorMode.get()), 0, 0)
        );
        applyColor
        (
            config,
            statusBarColorMode.get(),
            "statusBar.noFolderForeground",
            "statusBar.noFolderBackground",
            generateBackgroundColor(baseColorValue, 0, -2, -2),
        );
    };
}

export function activate(context: vscode.ExtensionContext): void
{
    FramePhiColors.initialize(context);
}

export function deactivate(): void
{
}
