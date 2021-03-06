import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import { phiColors } from 'phi-colors';

import localeEn from "../package.nls.json";
import localeJa from "../package.nls.ja.json";

interface LocaleEntry
{
    [key : string] : string;
}
const localeTableKey = <string>JSON.parse(<string>process.env.VSCODE_NLS_CONFIG).locale;
const localeTable = Object.assign(localeEn, ((<{[key : string] : LocaleEntry}>{
    ja : localeJa
})[localeTableKey] || { }));
const localeString = (key : string) : string => localeTable[key] || key;

module fx
{
    export function exists(path : string) : Thenable<boolean>
    {
        return new Promise
        (
            resolve => fs.exists
            (
                path,
                exists => resolve(exists)
            )
        );
    }
}

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
    const hasDir = async (dirs: string[]) =>
    {
        if (undefined !== rootWorkspaceFolder)
        {
            for(let i = 0; i < dirs.length; ++i)
            {
                if (await fx.exists(`${rootWorkspaceFolder.uri.fsPath}/${dirs[i]}`))
                {
                    return true;
                }
            }
        }
        return false;
    };
    const applyScopeObject = Object.freeze
    ({
        "none":
        {
            isEnabled: async () => false,
        },
        "has .vscode":
        {
            isEnabled: async () => await hasDir([".vscode"]),
        },
        "has .vscode or .git":
        {
            isEnabled: async () => await hasDir([".vscode", ".git"]),
        },
        "any":
        {
            isEnabled: async () => true,
        },
    });
    const colorSourceObject = Object.freeze
    ({
        "none":
        {
            getHashSource: () => null,
            configurationTarget: null,
        },
        "hostname":
        {
            getHashSource: () => os.hostname(),
            configurationTarget: vscode.ConfigurationTarget.Global,
        },
        "workspace":
        {
            getHashSource: () => getWorkspaceUri(),
            configurationTarget: vscode.ConfigurationTarget.Workspace,
        },
        "workspace-name":
        {
            getHashSource: () => getWorkspaceName(),
            configurationTarget: vscode.ConfigurationTarget.Workspace,
        },
        "document-fullpath":
        {
            getHashSource: () => getFullPathDocumentUri(),
            configurationTarget: vscode.ConfigurationTarget.Workspace,
        },
        "document":
        {
            getHashSource: () => getDocumentUri(),
            configurationTarget: vscode.ConfigurationTarget.Workspace,
        },
        "file-type":
        {
            getHashSource: () => getFileType(),
            configurationTarget: vscode.ConfigurationTarget.Workspace,
        },
    });
    const makeArranger = (hue: number, saturation: number = 0, lightness: number = 0, alpha: number = 0) =>
    ({
        hue,
        saturation,
        lightness,
        alpha,
    });
    const coloringStyleObject = Object.freeze
    ({
        "posi-light":
        {
            mainColorDirection: 1,
            isNegative: false,
        },
        "posi-dark":
        {
            mainColorDirection: -1,
            isNegative: false,
        },
        "nega-light":
        {
            mainColorDirection: 1,
            isNegative: true,
        },
        "nega-dark":
        {
            mainColorDirection: -1,
            isNegative: true,
        },
    });

    type ValueOf<T> = T[keyof T];
    type ApplyScopeKey = keyof typeof applyScopeObject;
    //type ApplyScope = ValueOf<typeof applyScopeObject>;
    type ColorSourceKey = keyof typeof colorSourceObject;
    type ColorSource = ValueOf<typeof colorSourceObject>;
    const colorCourceValidator = makeEnumValidator(Object.keys(colorSourceObject));
    type ColoringStyleKey = keyof typeof coloringStyleObject;
    type ColoringStyle = ValueOf<typeof coloringStyleObject>;
    const coloringStyleValidator = makeEnumValidator(Object.keys(coloringStyleObject));

    const baseColor = new Config("baseColor", "#5679C9", colorValidator);
    const applyScope = new Config<ApplyScopeKey>("applyScope", "has .vscode or .git", makeEnumValidator(Object.keys(applyScopeObject)));
    const titleBarColorSource = new Config<ColorSourceKey>("titleBarColorSource", "hostname", colorCourceValidator);
    const activityBarColorSource = new Config<ColorSourceKey>("activityBarColorSource", "workspace", colorCourceValidator);
    const statusBarColorSource = new Config<ColorSourceKey>("statusBarColorSource", "document", colorCourceValidator);
    const statusBarDebuggingColorSource = new Config<ColorSourceKey>("statusBarDebuggingColorSource", "document", colorCourceValidator);
    const titleBarColoringStyle = new Config<ColoringStyleKey>("titleBarColoringStyle", "nega-dark", coloringStyleValidator);
    const activityBarColoringStyle = new Config<ColoringStyleKey>("activityBarColoringStyle", "nega-dark", coloringStyleValidator);
    const statusBarColoringStyle = new Config<ColoringStyleKey>("statusBarColoringStyle", "posi-light", coloringStyleValidator);
    const statusBarDebuggingColoringStyle = new Config<ColoringStyleKey>("statusBarDebuggingColoringStyle", "posi-dark", coloringStyleValidator);
    const statusBarNoFolderColoringStyle = new Config<ColoringStyleKey>("statusBarNoFolderColoringStyle", "nega-dark", coloringStyleValidator);
    

    export const initialize = (context: vscode.ExtensionContext): void =>
    {
        context.subscriptions.push
        (
            //  イベントリスナーの登録
            vscode.workspace.onDidChangeConfiguration
            (
                () =>
                {
                    if
                    (
                        [
                            baseColor,
                            applyScope,
                            titleBarColorSource,
                            activityBarColorSource,
                            statusBarColorSource,
                            statusBarDebuggingColorSource,
                            titleBarColoringStyle,
                            activityBarColoringStyle,
                            statusBarColoringStyle,
                            statusBarDebuggingColoringStyle,
                            statusBarNoFolderColoringStyle,
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
        source.split("").map(i => i.codePointAt(0) || 0).reduce((a, b) => (a *173 +b +((a & 0x5555) >>> 5)) % 181);

    let rootWorkspaceFolder: vscode.WorkspaceFolder | undefined;
    const getWorkspaceUri = () => rootWorkspaceFolder ? rootWorkspaceFolder.uri: null;
    const getWorkspaceName = () => rootWorkspaceFolder ? rootWorkspaceFolder.uri.toString().replace(/^.*[\\\/]([^\\\/]+)$/, "$1"): null;
    let currentWorkspaceFolder: vscode.WorkspaceFolder | undefined;
    const getWorkspaceFolderUri = () => currentWorkspaceFolder ? currentWorkspaceFolder.uri: null;
    const getFullPathDocumentUri = () => vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.uri: null;
    const getDocumentUri = () =>
    {
        const document = getFullPathDocumentUri();
        const workspace = getWorkspaceFolderUri();
        return document && workspace && document.toString().startsWith(workspace.toString()) ?
            document.toString().substr(workspace.toString().length):
            document;
    };
    const getFileType = () => vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.uri.toString().replace(/.*(\.[^\.]*)/, "$1"): null;
    const getBaseColor = () => phiColors.rgbaToHsla(phiColors.rgbaFromStyle(baseColor.get()));
    const generateHueIndex = (source : vscode.Uri | string | null) => undefined === source ? null: hash(`${source}`);
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
            const values = this.config.inspect(this.key);
            switch(configurationTarget)
            {
            case vscode.ConfigurationTarget.Global:
                this.value = values?.globalValue ?? { };
                break;
            case vscode.ConfigurationTarget.Workspace:
                this.value = values?.workspaceValue ?? { };
                break;
            case vscode.ConfigurationTarget.WorkspaceFolder:
                this.value = values?.workspaceFolderValue ?? { };
                break;
            default:
                this.value = values?.defaultValue ?? { };
                break;
            }
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
        //workspaceFolder: ConfigBuffer | undefined;
        constructor(key: string)
        {
            this.global = new ConfigBuffer(vscode.ConfigurationTarget.Global, key);
            if (rootWorkspaceFolder)
            {
                this.workspace = new ConfigBuffer(vscode.ConfigurationTarget.Workspace, key);
                /*
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
                */
            }
        }
        update = () =>
            0 < (this.global.update() ? 0: 1)
                +((this.workspace && this.workspace.update()) ? 0: 1)
                //+((this.workspaceFolder && this.workspaceFolder.update()) ? 0: 1)
    }
    const applyConfig = (configBufferSet: ConfigBufferSet, source: ColorSource, key: string, value: string | undefined) =>
    {
        configBufferSet.global.value[key] = vscode.ConfigurationTarget.Global === source.configurationTarget ? value: undefined;
        if (configBufferSet.workspace)
        {
            //if (configBufferSet.workspaceFolder)
            //{
            //    configBufferSet.workspace.value[key] = vscode.ConfigurationTarget.Workspace === source.configurationTarget ? value: undefined;
            //    configBufferSet.workspaceFolder.value[key] = vscode.ConfigurationTarget.WorkspaceFolder === source.configurationTarget ? value: undefined;
            //}
            //else
            //{
                configBufferSet.workspace.value[key] = vscode.ConfigurationTarget.Workspace === source.configurationTarget || vscode.ConfigurationTarget.WorkspaceFolder === source.configurationTarget ? value: undefined;
            //}
        }
    };
    class ColorItem
    {
        public color: phiColors.Hsla | null;
        constructor
        (
            public key: string,
            arrangers:
            {
                hue :number,
                saturation :number,
                lightness :number,
                alpha :number,
            }[] | null
        )
        {
            if (arrangers)
            {
                const
                {
                    hue,
                    saturation,
                    lightness,
                    alpha,
                } = arrangers.reduce
                (
                    (v, i) =>
                    ({
                        hue: v.hue +i.hue,
                        saturation: v.saturation +i.saturation,
                        lightness: v.lightness +i.lightness,
                        alpha: v.hue +i.alpha,
                    })
                );
                this.color = phiColors.generate(getBaseColor(), hue, saturation, lightness, alpha);
            }
            else
            {
                this.color = null;
            }
        }
    }
    const applyColor = (configBufferSet: ConfigBufferSet, source: ColorSource, colorList: ColorItem[]) =>
    {
        colorList
        .forEach
        (
            item => applyConfig
            (
                configBufferSet,
                source,
                item.key,
                null !== item.color ?
                    phiColors.rgbForStyle(phiColors.hslaToRgba(item.color)):
                    undefined
            )
        );
    };
    const getConfigAndPallet = (sourceConfig: Config<ColorSourceKey>, modeConfig: Config<ColoringStyleKey>) =>
    {
        const source = colorSourceObject[sourceConfig.get()];
        const mode = coloringStyleObject[modeConfig.get()];
        const hash = generateHueIndex(source.getHashSource());

        return getPallet(source, mode, hash);
    };
    const getPallet = (source: ColorSource, mode: ColoringStyle, hash: number | null) =>
    {
        const generateForegroundColor = makeArranger(hash || 0, 0, (mode.isNegative ? -2: 4) *mode.mainColorDirection);
        const generateBackgroundColor = makeArranger(hash || 0, 0, (mode.isNegative ? 4: -0.5) *mode.mainColorDirection);

        return { source, mode, hash, generateForegroundColor, generateBackgroundColor };
    };

    const apply = async () =>
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

        if (await applyScopeObject[applyScope.get()].isEnabled())
        {
            const configBufferSet = new ConfigBufferSet("workbench.colorCustomizations");
            const titleBarColor = getConfigAndPallet(titleBarColorSource, titleBarColoringStyle);
            applyColor
            (
                configBufferSet,
                titleBarColor.source,
                [
                    new ColorItem("titleBar.activeForeground", null !== titleBarColor.hash ? [titleBarColor.generateForegroundColor]: null),
                    new ColorItem("titleBar.activeBackground", null !== titleBarColor.hash ? [titleBarColor.generateBackgroundColor]: null),
                    new ColorItem("titleBar.inactiveForeground", null !== titleBarColor.hash ? [titleBarColor.generateForegroundColor, makeArranger(0, 1, titleBarColor.mode.mainColorDirection)]: null),
                    new ColorItem("titleBar.inactiveBackground", null !== titleBarColor.hash ? [titleBarColor.generateBackgroundColor, makeArranger(0, 1, titleBarColor.mode.mainColorDirection)]: null),
                ]
            );
            const activityBarColor = getConfigAndPallet(activityBarColorSource, activityBarColoringStyle);
            applyColor
            (
                configBufferSet,
                activityBarColor.source,
                [
                    new ColorItem("activityBar.foreground", null !== activityBarColor.hash ? [activityBarColor.generateForegroundColor]: null),
                    new ColorItem("activityBar.background", null !== activityBarColor.hash ? [activityBarColor.generateBackgroundColor]: null),
                    new ColorItem("activityBar.inactiveForeground", null !== activityBarColor.hash ? [activityBarColor.generateForegroundColor, makeArranger(-0.1, 0, activityBarColor.mode.mainColorDirection *(activityBarColor.mode.isNegative ? 3: -4))]: null),
                    new ColorItem("activityBarBadge.foreground", null !== activityBarColor.hash ? [makeArranger(activityBarColor.hash +0.2, 0.5, 1.0), makeArranger(0, 0, activityBarColor.mode.mainColorDirection *5)]: null),
                    new ColorItem("activityBarBadge.background", null !== activityBarColor.hash ? [makeArranger(activityBarColor.hash +0.2, 0.5, 1.0), makeArranger(0, 0, activityBarColor.mode.mainColorDirection *0)]: null),
                ]
            );
            const statusBarColor = getConfigAndPallet(statusBarColorSource, statusBarColoringStyle);
            applyColor
            (
                configBufferSet,
                statusBarColor.source,
                [
                    new ColorItem("statusBar.foreground", null !== statusBarColor.hash ? [statusBarColor.generateForegroundColor]: null),
                    new ColorItem("statusBar.background", null !== statusBarColor.hash ? [statusBarColor.generateBackgroundColor]: null),
                    new ColorItem("statusBarItem.hoverBackground", null !== statusBarColor.hash ? [makeArranger((statusBarColor.hash || 0) +0.1, -1, -1)]: null),
                    new ColorItem("statusBarItem.remoteForeground", null !== statusBarColor.hash ? [statusBarColor.generateForegroundColor, makeArranger(0.2)]: null),
                    new ColorItem("statusBarItem.remoteBackground", null !== statusBarColor.hash ? [statusBarColor.generateBackgroundColor, makeArranger(0.2)]: null),
                ]
            );
            const statusBarDebuggingColor = getConfigAndPallet(statusBarDebuggingColorSource, statusBarDebuggingColoringStyle);
            applyColor
            (
                configBufferSet,
                statusBarDebuggingColor.source,
                [
                    new ColorItem("statusBar.debuggingForeground", null !== statusBarDebuggingColor.hash ? [statusBarDebuggingColor.generateForegroundColor]: null),
                    new ColorItem("statusBar.debuggingBackground", null !== statusBarDebuggingColor.hash ? [statusBarDebuggingColor.generateBackgroundColor]: null),
                ]
            );
            const statusBarNoFolderColor = getPallet
            (
                colorSourceObject.hostname, // 保存 Scope を global にする為
                coloringStyleObject[statusBarNoFolderColoringStyle.get()],
                0 // hash は固定
            );
            applyColor
            (
                configBufferSet,
                statusBarNoFolderColor.source,
                [
                    new ColorItem("statusBar.noFolderForeground", [statusBarNoFolderColor.generateForegroundColor, makeArranger(0, -2, statusBarNoFolderColor.mode.mainColorDirection *-2)]),
                    new ColorItem("statusBar.noFolderBackground", [statusBarNoFolderColor.generateBackgroundColor, makeArranger(0, -2, statusBarNoFolderColor.mode.mainColorDirection *-2)]),
                ]
            );
            if (configBufferSet.update())
            {
                console.log(localeString('🌈 applyed frame-phi-colors!!!'));
            }
        }
        else
        {
            console.log('🚫 frame-phi-colors is disabled.');
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
