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
        {
            getHashSource: () => os.hostname(),
            configurationTarget: vscode.ConfigurationTarget.Global,
        },
        "workspace":
        {
            getHashSource: () => getWorkspaceUri(),
            configurationTarget: vscode.ConfigurationTarget.Workspace,
        },
        "workspace-folder":
        {
            getHashSource: () => getWorkspaceFolderUri(),
            configurationTarget: vscode.ConfigurationTarget.WorkspaceFolder,
        },
        "document":
        {
            getHashSource: () => getDocumentUri(),
            configurationTarget: vscode.ConfigurationTarget.WorkspaceFolder,
        },
        "file-type":
        {
            getHashSource: () => getFileType(),
            configurationTarget: vscode.ConfigurationTarget.WorkspaceFolder,
        },
    });

    type ColorModeKey = keyof typeof colorModeObject;
    type ValueOf<T> = T[keyof T];
    type ColorMode = ValueOf<typeof colorModeObject>;
    const colorModeValidator = makeEnumValidator(Object.keys(colorModeObject));

    const titleBarColorMode = new Config<ColorModeKey>("titleColorMode", "hostname", colorModeValidator);
    const activityBarColorMode = new Config<ColorModeKey>("activityBarColorMode", "workspace", colorModeValidator);
    const statusBarColorMode = new Config<ColorModeKey>("statusBarColorMode", "document", colorModeValidator);
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
    const getBaseColor = () => phiColors.rgbaToHsla(phiColors.rgbaFromStyle(baseColor.get()));
    const generateHueIndex = (source : vscode.Uri | string | null) => undefined === source ? null: hash(`${source}`);
    const makeArranger = (hue: number, saturation: number = 0, lightness: number = 0) => (baseColor: phiColors.Hsla) => phiColors.generate(baseColor, hue, saturation, lightness, 0);
    const generateForegroundColor = (backgroundColor: phiColors.Hsla) => phiColors.generate
    (
        backgroundColor,
        0,
        0,
        backgroundColor.l < (phiColors.HslHMin +phiColors.HslLMax) /2 ? 3: -3,
        0
    );
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
                return true;
            }
            return false;
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
            0 < (this.global.update() ? 0: 1)
                +((this.workspace && this.workspace.update()) ? 0: 1)
                +((this.workspaceFolder && this.workspaceFolder.update()) ? 0: 1)
    }
    const applyConfig = (configBufferSet: ConfigBufferSet, mode: ColorMode, key: string, value: string | undefined) =>
    {
        configBufferSet.global.value[key] = vscode.ConfigurationTarget.Global === mode.configurationTarget ? value: undefined;
        if (configBufferSet.workspace)
        {
            if (configBufferSet.workspaceFolder)
            {
                configBufferSet.workspace.value[key] = vscode.ConfigurationTarget.Workspace === mode.configurationTarget ? value: undefined;
                configBufferSet.workspaceFolder.value[key] = vscode.ConfigurationTarget.WorkspaceFolder === mode.configurationTarget ? value: undefined;
            }
            else
            {
                configBufferSet.workspace.value[key] = vscode.ConfigurationTarget.Workspace === mode.configurationTarget || vscode.ConfigurationTarget.WorkspaceFolder === mode.configurationTarget ? value: undefined;
            }
        }
    };
    class ColorSource
    {
        public color: phiColors.Hsla | null;
        constructor(public key: string, arrangers: ((source: phiColors.Hsla)=> phiColors.Hsla)[] | null)
        {
            this.color = arrangers ? arrangers.reduce((v, i) => i(v), getBaseColor()): null;
        }
    }
    const applyColor = (configBufferSet: ConfigBufferSet, mode: ColorMode, colorList: ColorSource[]) =>
    {
        colorList
        .forEach
        (
            source => applyConfig
            (
                configBufferSet,
                mode,
                source.key,
                null !== source.color ?
                    phiColors.rgbForStyle(phiColors.hslaToRgba(source.color)):
                    undefined
            )
        );
    };
    const getModeAndHash = (config: Config<ColorModeKey>) =>
    {
        const mode = colorModeObject[config.get()];
        const hash = generateHueIndex(mode.getHashSource());
        return { mode, hash };
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

        const configBufferSet = new ConfigBufferSet("workbench.colorCustomizations");
        const titleBarColor = getModeAndHash(titleBarColorMode);
        applyColor
        (
            configBufferSet,
            titleBarColor.mode,
            [
                new ColorSource("titleBar.foreground", titleBarColor.hash ? [makeArranger(titleBarColor.hash), generateForegroundColor]: null),
                new ColorSource("titleBar.background", titleBarColor.hash ? [makeArranger(titleBarColor.hash)]: null),
            ]
        );
        const activityBarColor = getModeAndHash(activityBarColorMode);
        applyColor
        (
            configBufferSet,
            activityBarColor.mode,
            [
                new ColorSource("activityBar.foreground", activityBarColor.hash ? [makeArranger(activityBarColor.hash), generateForegroundColor]: null),
                new ColorSource("activityBar.background", activityBarColor.hash ? [makeArranger(activityBarColor.hash)]: null),
                new ColorSource("activityBar.inactiveForeground", activityBarColor.hash ? [makeArranger(activityBarColor.hash, -1.0, -1.0), generateForegroundColor]: null),
                new ColorSource("activityBarBadge.foreground", activityBarColor.hash ? [makeArranger(activityBarColor.hash +0.2, 0.5, 0.5), generateForegroundColor]: null),
                new ColorSource("activityBarBadge.background", activityBarColor.hash ? [makeArranger(activityBarColor.hash +0.2, 0.5, 0.5)]: null),
            ]
        );
        const statusBarColor = getModeAndHash(statusBarColorMode);
        applyColor
        (
            configBufferSet,
            statusBarColor.mode,
            [
                new ColorSource("statusBar.foreground", statusBarColor.hash ? [makeArranger(statusBarColor.hash), generateForegroundColor]: null),
                new ColorSource("statusBar.background", statusBarColor.hash ? [makeArranger(statusBarColor.hash)]: null),
                new ColorSource("statusBar.noFolderForeground", [makeArranger(0, -2, -2), generateForegroundColor]),
                new ColorSource("statusBar.noFolderBackground", [makeArranger(0, -2, -2)]),
            ]
        );
        if (configBufferSet.update())
        {
            console.log('🌈 applyed frame-phi-colors!!!');
        }
    };
}

export function activate(context: vscode.ExtensionContext): void
{
    FramePhiColors.initialize(context);
}

export function deactivate(): void
{
}
