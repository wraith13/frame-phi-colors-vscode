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

    const titleBarColorMode = new Config<colorMode>("titleColorMode", "hostname", colorModeValidator);
    const activityBarColorMode = new Config<colorMode>("activityBarColorMode", "workspace", colorModeValidator);
    const statusBarColorMode = new Config<colorMode>("statusBarColorMode", "document", colorModeValidator);
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
            vscode.window.onDidChangeActiveTextEditor(() => apply()),
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
    const generateHueIndex = (source : vscode.Uri | string | null) => undefined === source ? null: hash(`${source}`);
    const generateHueIndexByMode = (mode: colorMode) => generateHueIndex(getHashSourceByMode(mode));
    const generateBackgroundColor = (baseColor: string, hue: number | null, saturation: number, lightness: number) => null !== hue ?
        phiColors.generate
        (
            phiColors.rgbaToHsla(phiColors.rgbaFromStyle(baseColor)),
            hue,
            saturation,
            lightness,
            0
        ):
        null;
    const generateForegroundColor = (backgroundColor: phiColors.Hsla) => phiColors.generate
    (
        backgroundColor,
        0,
        0,
        backgroundColor.l < (phiColors.HslHMin +phiColors.HslLMax) /2 ? 3: -3,
        0
    );
    const getConfigurationTarget = (mode: colorMode) =>
    {
        switch(mode)
        {
        case "none":
            return null;
        case "hostname":
            return vscode.ConfigurationTarget.Global;
        case "workspace":
            return vscode.ConfigurationTarget.Workspace;
        case "workspace-folder":
            return vscode.ConfigurationTarget.WorkspaceFolder;
        case "document":
            return vscode.ConfigurationTarget.WorkspaceFolder;
        case "file-type":
            return vscode.ConfigurationTarget.WorkspaceFolder;
        }
    };
    const getConfigurationUri = (configurationTarget: vscode.ConfigurationTarget) =>
    {
        switch(configurationTarget)
        {
        case vscode.ConfigurationTarget.Global:
            return undefined;
        case vscode.ConfigurationTarget.Workspace:
            return getWorkspaceUri();
        case vscode.ConfigurationTarget.WorkspaceFolder:
            return getWorkspaceFolderUri();
        }
    };
    class ConfigBuffer
    {
        config: vscode.WorkspaceConfiguration;
        value: any;
        constructor(public configurationTarget: vscode.ConfigurationTarget, public key: string)
        {
            this.config = vscode.workspace.getConfiguration(undefined, getConfigurationUri(configurationTarget));
            this.value = this.config.get(this.key, { });
        }
        update = () =>
        {
            if (JSON.stringify(this.config.get(this.key, { })) !== JSON.stringify(this.value))
            {
                this.config.update(this.key, this.value, this.configurationTarget);
            }
        }
    }
    class ConfigBufferSet
    {
        global: ConfigBuffer;
        workspace: ConfigBuffer | undefined;
        workspaceFolder: ConfigBuffer | undefined;
        constructor(key: string)
        {
            this.global = new ConfigBuffer(vscode.ConfigurationTarget.Global, key);
            if (rootWorkspaceFolder)
            {
                this.workspace = new ConfigBuffer(vscode.ConfigurationTarget.Workspace, key);
                if
                (
                    vscode.workspace.workspaceFolders &&
                    1 < vscode.workspace.workspaceFolders.length &&
                    vscode.window.activeTextEditor &&
                    vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)
                )
                {
                    this.workspaceFolder = new ConfigBuffer(vscode.ConfigurationTarget.WorkspaceFolder, key);
                }
            }
        }
        update = () =>
        {
            this.global.update();
            if (this.workspace)
            {
                this.workspace.update();
            }
            if (this.workspaceFolder)
            {
                this.workspaceFolder.update();
            }
        }
    }
    const applyConfig = (configBufferSet: ConfigBufferSet, mode: colorMode, key: string, value: string | undefined) =>
    {
        const configurationTarget = getConfigurationTarget(mode);
        configBufferSet.global.value[key] = vscode.ConfigurationTarget.Global === configurationTarget ? value: undefined;
        if (configBufferSet.workspace)
        {
            if (configBufferSet.workspaceFolder)
            {
                configBufferSet.workspace.value[key] = vscode.ConfigurationTarget.Workspace === configurationTarget ? value: undefined;
                configBufferSet.workspaceFolder.value[key] = vscode.ConfigurationTarget.WorkspaceFolder === configurationTarget ? value: undefined;
            }
            else
            {
                configBufferSet.workspace.value[key] = vscode.ConfigurationTarget.Workspace === configurationTarget || vscode.ConfigurationTarget.WorkspaceFolder === configurationTarget ? value: undefined;
            }
        }
    };
    const applyColor = (configBufferSet: ConfigBufferSet, mode: colorMode, foregroundKey: string, backgroundKey: string | undefined, backgroundColor: phiColors.Hsla | null) =>
    {
        applyConfig(configBufferSet, mode, foregroundKey, null !== backgroundColor ? phiColors.rgbForStyle(phiColors.hslaToRgba(generateForegroundColor(backgroundColor))): undefined);
        if (backgroundKey)
        {
            applyConfig(configBufferSet, mode, backgroundKey, null !== backgroundColor ? phiColors.rgbForStyle(phiColors.hslaToRgba(backgroundColor)): undefined);
        }
    };
    const ifExist = <sourceType,resultType>(source: sourceType | null, method: (source: sourceType)=>resultType): resultType | null => null === source ? null: method(source);

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
        const configBufferSet = new ConfigBufferSet("workbench.colorCustomizations");

        const baseColorValue = baseColor.get();
        applyColor
        (
            configBufferSet,
            titleBarColorMode.get(),
            "titleBar.foreground",
            "titleBar.background",
            generateBackgroundColor(baseColorValue, generateHueIndexByMode(titleBarColorMode.get()), 0, 0)
        );
        applyColor
        (
            configBufferSet,
            activityBarColorMode.get(),
            "activityBar.foreground",
            "activityBar.background",
            generateBackgroundColor(baseColorValue, generateHueIndexByMode(activityBarColorMode.get()), 0, 0)
        );
        applyColor
        (
            configBufferSet,
            activityBarColorMode.get(),
            "activityBar.inactiveForeground",
            undefined,
            generateBackgroundColor(baseColorValue, generateHueIndexByMode(activityBarColorMode.get()), -1.0, -1.0)
        );
        applyColor
        (
            configBufferSet,
            activityBarColorMode.get(),
            "activityBarBadge.foreground",
            "activityBarBadge.background",
            generateBackgroundColor(baseColorValue, ifExist(generateHueIndexByMode(activityBarColorMode.get()), x => x +0.2), 0.5, 0.5)
        );
        applyColor
        (
            configBufferSet,
            statusBarColorMode.get(),
            "statusBar.foreground",
            "statusBar.background",
            generateBackgroundColor(baseColorValue, generateHueIndexByMode(statusBarColorMode.get()), 0, 0)
        );
        applyColor
        (
            configBufferSet,
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
